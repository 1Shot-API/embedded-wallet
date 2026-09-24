import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { IChainRepository } from "../../../interfaces/data/IChainRepository";
import type { IOneshotRelayerRepository } from "../../../interfaces/data/IOneshotRelayerRepository";
import type { ITrackedAssetRepository } from "../../../interfaces/data/ITrackedAssetRepository";
import type { IPaymentTokenUtils } from "../../../interfaces/business/utils/IPaymentTokenUtils";
import type { IPaymentTokenOption } from "../../../interfaces/business/ITransactionService";
import type { IRelayerPayment } from "../../../types/domain/RelayerPayment";
import { EAssetType } from "../../../types/enum/EAssetType";
import { makeTokenAmount } from "../../../types/primitives";
import { DEFAULT_CHAIN_ID } from "../../data/HardcodedChainRepository";

type ChainPaymentOptions = {
  chainId: EVMChainId;
  chainName: string;
  tokens: IPaymentTokenOption[];
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
    preferredToken?: EVMAccountAddress,
  ): Promise<IRelayerPayment | null> {
    const unique = uniqueChainIds(executionChainIds);
    if (unique.length === 0) return null;

    const executionOptions = (
      await Promise.all(unique.map((id) => this.loadChainOptions(owner, id)))
    ).filter((row): row is ChainPaymentOptions => row !== null);

    const fundedExecution: Array<{
      row: ChainPaymentOptions;
      selected: IPaymentTokenOption;
    }> = [];
    for (const row of executionOptions) {
      const selected = pickPaymentToken(row.tokens, preferredToken);
      if (selected) fundedExecution.push({ row, selected });
    }

    // 1. Exactly one execution chain has a funded payment token → pay locally.
    if (fundedExecution.length === 1) {
      const only = fundedExecution[0]!;
      return toRelayerPayment(only.row, only.selected);
    }

    // 2. Arc USDC fallback (always considered, even if not in execution set).
    const arcOptions = await this.loadChainOptions(owner, DEFAULT_CHAIN_ID);
    if (arcOptions) {
      const usdc = arcOptions.tokens.find(
        (t) => t.symbol.toUpperCase() === "USDC" && t.balance > 0n,
      );
      if (usdc) return toRelayerPayment(arcOptions, usdc);
    }

    // 3. First execution chain with any funded payment token (stable order).
    if (fundedExecution.length > 0) {
      const first = fundedExecution[0]!;
      return toRelayerPayment(first.row, first.selected);
    }

    return null;
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

      const balanceByAddress = new Map(
        tracked.map((asset) => [
          String(asset.address).toLowerCase(),
          asset.balance ?? 0n,
        ]),
      );

      const tokens: IPaymentTokenOption[] = capabilities.tokens.map(
        (token) => ({
          ...token,
          balance: makeTokenAmount(
            balanceByAddress.get(String(token.address).toLowerCase()) ?? 0n,
          ),
        }),
      );

      // Also surface tracked USDC that appears in capabilities (activation path).
      for (const asset of tracked) {
        if (asset.type !== EAssetType.Erc20) continue;
        if (asset.symbol.toUpperCase() !== "USDC") continue;
        const key = String(asset.address).toLowerCase();
        const already = tokens.some(
          (t) => String(t.address).toLowerCase() === key,
        );
        if (already) continue;
        const accepted = capabilities.tokens.some(
          (t) => String(t.address).toLowerCase() === key,
        );
        if (!accepted) continue;
        tokens.push({
          address: asset.address,
          symbol: asset.symbol,
          decimals: asset.decimals,
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

function uniqueChainIds(chainIds: readonly EVMChainId[]): EVMChainId[] {
  const unique: EVMChainId[] = [];
  const seen = new Set<string>();
  for (const id of chainIds) {
    const key = BigInt(id).toString(10);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(id);
  }
  return unique;
}

function pickPaymentToken(
  tokens: IPaymentTokenOption[],
  preferred?: EVMAccountAddress,
): IPaymentTokenOption | null {
  const withBalance = tokens.filter((t) => t.balance > 0n);
  if (preferred) {
    const match = withBalance.find(
      (t) =>
        String(t.address).toLowerCase() === String(preferred).toLowerCase(),
    );
    if (match) return match;
  }
  const usdc = withBalance.find((t) => t.symbol.toUpperCase() === "USDC");
  if (usdc) return usdc;
  const usdt = withBalance.find((t) => t.symbol.toUpperCase() === "USDT");
  if (usdt) return usdt;
  return withBalance[0] ?? null;
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
