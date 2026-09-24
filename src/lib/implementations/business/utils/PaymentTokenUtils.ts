import {
  ChainUtils,
  EVMContractAddress,
  type EVMAccountAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";
import { parseUnits } from "viem";
import type { IChainRepository } from "../../../interfaces/data/IChainRepository";
import type { IOneshotRelayerRepository } from "../../../interfaces/data/IOneshotRelayerRepository";
import type { ITrackedAssetRepository } from "../../../interfaces/data/ITrackedAssetRepository";
import type { IPaymentTokenUtils } from "../../../interfaces/business/utils/IPaymentTokenUtils";
import type { IPaymentTokenOption } from "../../../interfaces/business/ITransactionService";
import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";
import { EAssetType } from "../../../types/enum/EAssetType";
import { makeTokenAmount } from "../../../types/primitives";
import { DEFAULT_CHAIN_ID } from "../../data/HardcodedChainRepository";

/** Matches unsigned quote seed in TransactionUtils (`parseUnits("0.01", decimals)`). */
const SEED_FEE_HUMAN = "0.01";

type ChainPaymentOptions = {
  chainId: EVMChainId;
  chainName: string;
  tokens: IPaymentTokenOption[];
};

type FundedPick = {
  row: ChainPaymentOptions;
  selected: IPaymentTokenOption;
};

/**
 * Single policy for which chain/token pays the public-relayer fee.
 */
export class PaymentTokenUtils implements IPaymentTokenUtils {
  constructor(
    protected readonly chainRepository: IChainRepository,
    protected readonly relayerRepository: IOneshotRelayerRepository,
    protected readonly trackedAssetRepository: ITrackedAssetRepository,
  ) {}

  async resolvePayment(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
    preferredToken?: EVMContractAddress,
  ): Promise<IRelayerPayment | null> {
    const unique = uniqueChainIds(executionChainIds);
    if (unique.length === 0) return null;

    const { execution, arc, others } = await this.loadCandidateChains(
      owner,
      unique,
    );
    const searchOrder = [...execution, ...arcRows(arc, unique), ...others];

    // 1. Preferred token wins on any candidate chain (any positive balance —
    //    user explicitly chose it; quote/UI can still surface insufficiency).
    if (preferredToken) {
      for (const row of searchOrder) {
        const match = findTokenByAddress(row.tokens, preferredToken, true);
        if (match) return toRelayerPayment(row, match);
      }
    }

    // 2. Work chains — Arc default when it can cover the seed fee; else first
    //    usable execution chain (skips dust that would fail estimate).
    const fundedExecution = fundedPicks(execution);
    const arcInExecution = fundedExecution.find(
      (p) => p.row.chainId === DEFAULT_CHAIN_ID,
    );
    if (arcInExecution) {
      return toRelayerPayment(arcInExecution.row, arcInExecution.selected);
    }
    if (fundedExecution.length > 0) {
      const first = fundedExecution[0]!;
      return toRelayerPayment(first.row, first.selected);
    }

    // 3. Arc fallback (even when not in execution set).
    if (arc) {
      const usdc = arc.tokens.find(
        (t) => t.symbol.toUpperCase() === "USDC" && hasSeedBalance(t),
      );
      if (usdc) return toRelayerPayment(arc, usdc);
      const any = pickPaymentToken(arc.tokens);
      if (any) return toRelayerPayment(arc, any);
    }

    // 4. Other wallet relayer chains.
    for (const row of others) {
      const selected = pickPaymentToken(row.tokens);
      if (selected) return toRelayerPayment(row, selected);
    }

    return null;
  }

  async listPaymentOptions(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
  ): Promise<IPaymentTokenOption[]> {
    const unique = uniqueChainIds(executionChainIds);
    const { execution, arc, others } = await this.loadCandidateChains(
      owner,
      unique,
    );
    const priorityRows = [...execution, ...arcRows(arc, unique)];
    const priorityChainIds = new Set(priorityRows.map((r) => r.chainId));
    const rows = [...priorityRows, ...others];
    const options: IPaymentTokenOption[] = [];
    const seen = new Set<string>();
    for (const row of rows) {
      for (const token of row.tokens) {
        // Always list execution + Arc tokens; other chains only when funded.
        if (!priorityChainIds.has(row.chainId) && token.balance <= 0n) {
          continue;
        }
        const key = `${token.chainId}:${token.address}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push(token);
      }
    }
    return options;
  }

  private async loadCandidateChains(
    owner: EVMAccountAddress,
    executionChainIds: readonly EVMChainId[],
  ): Promise<{
    execution: ChainPaymentOptions[];
    arc: ChainPaymentOptions | null;
    others: ChainPaymentOptions[];
  }> {
    const execution = (
      await Promise.all(
        executionChainIds.map((id) => this.loadChainOptions(owner, id)),
      )
    ).filter((row): row is ChainPaymentOptions => row !== null);

    const executionSet = new Set(executionChainIds);
    const arc = executionSet.has(DEFAULT_CHAIN_ID)
      ? (execution.find((r) => r.chainId === DEFAULT_CHAIN_ID) ?? null)
      : await this.loadChainOptions(owner, DEFAULT_CHAIN_ID);

    const catalog = await this.chainRepository.list();
    const considered = new Set<EVMChainId>([
      ...executionChainIds,
      DEFAULT_CHAIN_ID,
    ]);
    const otherIds: EVMChainId[] = [];
    for (const c of catalog) {
      if (!c.useRelayer) continue;
      if (!ChainUtils.isEVMChainId(c.chainId)) continue;
      if (considered.has(c.chainId)) continue;
      otherIds.push(c.chainId);
    }
    const others = (
      await Promise.all(otherIds.map((id) => this.loadChainOptions(owner, id)))
    ).filter((row): row is ChainPaymentOptions => row !== null);

    return { execution, arc, others };
  }

  private async loadChainOptions(
    owner: EVMAccountAddress,
    chainId: EVMChainId,
  ): Promise<ChainPaymentOptions | null> {
    try {
      const chain = await this.chainRepository.get(chainId);
      if (!chain?.useRelayer) return null;

      const [tracked, capabilities] = await Promise.all([
        this.trackedAssetRepository.getBalances(owner, { chainId }),
        this.relayerRepository.getCapabilities(chain.relayerUrl, chainId),
      ]);

      // Tracked assets still brand ERC-20s as EVMAccountAddress; both brands
      // share the EIP-55 string so Map lookup by contract address works.
      const balanceByAddress = new Map<EVMContractAddress, bigint>(
        tracked.map((asset) => [asset.address, asset.balance ?? 0n]),
      );

      const tokens: IPaymentTokenOption[] = capabilities.tokens.map(
        (token) => ({
          ...token,
          chainId,
          chainName: chain.label,
          balance: makeTokenAmount(balanceByAddress.get(token.address) ?? 0n),
        }),
      );

      // Also surface tracked USDC that appears in capabilities (activation path).
      for (const asset of tracked) {
        if (asset.type !== EAssetType.Erc20) continue;
        if (asset.symbol.toUpperCase() !== "USDC") continue;
        const contract = asset.address;
        const already = tokens.some((t) => t.address === contract);
        if (already) continue;
        const accepted = capabilities.tokens.some(
          (t) => t.address === contract,
        );
        if (!accepted) continue;
        tokens.push({
          address: contract,
          symbol: asset.symbol,
          decimals: asset.decimals,
          chainId,
          chainName: chain.label,
          balance: makeTokenAmount(asset.balance ?? 0n),
        });
      }

      return {
        chainId,
        chainName: chain.label,
        tokens,
      };
    } catch {
      return null;
    }
  }
}

/** Arc row only when not already included in the execution list. */
function arcRows(
  arc: ChainPaymentOptions | null,
  executionChainIds: readonly EVMChainId[],
): ChainPaymentOptions[] {
  if (!arc) return [];
  if (executionChainIds.includes(DEFAULT_CHAIN_ID)) return [];
  return [arc];
}

function fundedPicks(rows: ChainPaymentOptions[]): FundedPick[] {
  const out: FundedPick[] = [];
  for (const row of rows) {
    const selected = pickPaymentToken(row.tokens);
    if (selected) out.push({ row, selected });
  }
  return out;
}

function uniqueChainIds(chainIds: readonly EVMChainId[]): EVMChainId[] {
  const unique: EVMChainId[] = [];
  const seen = new Set<EVMChainId>();
  for (const id of chainIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    unique.push(id);
  }
  return unique;
}

function hasSeedBalance(token: IPaymentTokenOption): boolean {
  try {
    return token.balance >= parseUnits(SEED_FEE_HUMAN, token.decimals);
  } catch {
    return token.balance > 0n;
  }
}

function findTokenByAddress(
  tokens: IPaymentTokenOption[],
  address: EVMContractAddress,
  requireBalance: boolean,
): IPaymentTokenOption | null {
  const match = tokens.find(
    (t) => t.address === address && (!requireBalance || t.balance > 0n),
  );
  return match ?? null;
}

function pickPaymentToken(
  tokens: IPaymentTokenOption[],
  preferred?: EVMContractAddress,
): IPaymentTokenOption | null {
  // Default picks require enough balance for the unsigned seed fee so dust on
  // Arc does not win over a usable Base balance.
  const usable = tokens.filter((t) => hasSeedBalance(t));
  if (preferred) {
    const match = usable.find((t) => t.address === preferred);
    if (match) return match;
    const anyPreferred = tokens.find(
      (t) => t.address === preferred && t.balance > 0n,
    );
    if (anyPreferred) return anyPreferred;
  }
  const usdc = usable.find((t) => t.symbol.toUpperCase() === "USDC");
  if (usdc) return usdc;
  const usdt = usable.find((t) => t.symbol.toUpperCase() === "USDT");
  if (usdt) return usdt;
  return usable[0] ?? null;
}

function toRelayerPayment(
  row: ChainPaymentOptions,
  selected: IPaymentTokenOption,
): IRelayerPayment {
  return {
    paymentChainId: row.chainId,
    paymentToken: selected.address,
    paymentChainName: row.chainName,
    balance: selected.balance,
    decimals: selected.decimals,
    symbol: selected.symbol,
  };
}
