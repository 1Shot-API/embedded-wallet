import {
  createDelegation,
  Implementation,
  ScopeType,
  toMetaMaskSmartAccount,
  type Delegation,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import {
  decodeDelegations,
  encodeDelegations,
  hashDelegation,
} from "@metamask/smart-accounts-kit/utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  DomainString,
  EVMAccountAddress,
  EVMContractAddress,
  HexString,
  UnixTimestamp,
  type CeremonyUiParams,
  type EVMChainId,
  type IExecutionPermission,
  type IExecutionPermissionResponse,
  type SupportedExecutionPermissions,
} from "@1shotapi/ows-types";
import { getAddress, type Hex } from "viem";
import type { LocalAccount } from "viem/accounts";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type { IDelegationRepository } from "../../interfaces/data/IDelegationRepository";
import type {
  ICancelDelegationParams,
  ICancelDelegationResult,
  ICreateExecutionPermissionParams,
  IDelegationService,
} from "../../interfaces/business/IDelegationService";
import { ERC20_TOKEN_PERIODIC } from "../../interfaces/business/IDelegationService";
import type { ITransactionUtils } from "../../interfaces/business/utils/ITransactionUtils";
import type { ITransactionUtils as IPresentationTransactionUtils } from "../../interfaces/utils/ITransactionUtils";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";
import type {
  ISignedDelegation,
  IStoredDelegation,
} from "../../types/domain/StoredDelegation";
import { makeDelegationId } from "../../types/primitives/DelegationId";
import { EPasskeyPromptReason } from "../../types/enum/EPasskeyPromptReason";
import { withCeremonyUiReason } from "../../../wallet/ceremonyUiOverrideStore";
import { withCoalescedSignDigest } from "../../../wallet/withCoalescedSignDigest";
import { loadCachedEvmAddress } from "../../../storage";
import { styleController } from "../../../style/styleController";

export type DelegationServiceOptions = {
  chainRepository: IChainRepository;
  delegationRepository: IDelegationRepository;
  blockchain: IBlockchainProvider;
  transactionUtils: ITransactionUtils;
  presentationTransactionUtils: IPresentationTransactionUtils;
  owsProvider: IOWSProvider;
};

/**
 * MetaMask StatelessDelegator grants + on-chain disable via public relayer.
 */
export class DelegationService implements IDelegationService {
  constructor(private readonly options: DelegationServiceOptions) {}

  async createExecutionPermission(
    params: ICreateExecutionPermissionParams,
  ): Promise<IStoredDelegation> {
    const { request, permission, memo, onDelegationSigned } = params;
    this.assertPeriodicPermission(permission);
    await this.requireRelayerChain(request.chainId);
    const period = parseErc20PeriodData(permission.data);

    const signer = await this.options.owsProvider.getSigner();
    const eoa =
      request.from ??
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    // Warm upgrade cache; on-chain upgrade is attached on cancel/send, not grant.
    await this.options.transactionUtils.needsWalletUpgrade(
      request.chainId,
      eoa,
    );

    const { smartAccount, environment } = await this.createSmartAccount(
      request.chainId,
      eoa,
    );

    const salt = randomSalt32();
    const startDate = period.startDate ?? Math.floor(Date.now() / 1000);

    await this.options.owsProvider.ensureDisplay();
    try {
      const grantCopy = grantPermissionCeremony();
      const signedDelegation = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(signer, grantCopy, async () => {
            const unsigned = createDelegation({
              to: getAddress(request.to),
              from: smartAccount.address,
              environment,
              salt,
              scope: {
                type: ScopeType.Erc20PeriodTransfer,
                tokenAddress: getAddress(period.tokenAddress),
                periodAmount: period.periodAmount,
                periodDuration: period.periodDuration,
                startDate,
              },
            });
            const signature = await smartAccount.signDelegation({
              delegation: unsigned,
            });
            return { ...unsigned, signature } satisfies Delegation;
          }),
      );

      await onDelegationSigned?.();
      await this.options.delegationRepository.prepareRelayerVaultAssertion();

      const delegationHash = HexString(hashDelegation(signedDelegation));
      const context = HexString(
        encodeDelegations([signedDelegation]) as `0x${string}`,
      );
      const delegationManager = EVMContractAddress(
        getAddress(environment.DelegationManager),
      );

      const attenuatedPermission: IExecutionPermission = {
        type: ERC20_TOKEN_PERIODIC,
        isAdjustmentAllowed: permission.isAdjustmentAllowed,
        data: {
          tokenAddress: period.tokenAddress,
          periodAmount: `0x${period.periodAmount.toString(16)}`,
          periodDuration: period.periodDuration,
          startDate,
          ...(period.justification
            ? { justification: period.justification }
            : {}),
        },
      };

      const permissionResponse: IExecutionPermissionResponse = {
        chainId: request.chainId,
        from: eoa,
        to: request.to,
        permission: attenuatedPermission,
        ...(request.rules ? { rules: request.rules } : {}),
        context,
        dependencies: [],
        delegationManager,
      };

      const hostRaw =
        this.options.presentationTransactionUtils.resolveHostDomain();
      const hostDomain = DomainString(
        hostRaw === "the connected app" ? "unknown" : hostRaw,
      );

      const stored: IStoredDelegation = {
        delegationId: makeDelegationId(String(delegationHash)),
        delegationHash,
        chainId: request.chainId,
        hostDomain,
        memo: memo.trim(),
        createdAt: UnixTimestamp(Math.floor(Date.now() / 1000)),
        delegation: toSignedDelegation(signedDelegation),
        permissionResponse,
      };

      await this.options.delegationRepository.storeDelegation(stored);
      return stored;
    } finally {
      await this.options.owsProvider.hideDisplay();
    }
  }

  async cancelDelegation(
    params: ICancelDelegationParams,
  ): Promise<ICancelDelegationResult> {
    const chain = await this.requireRelayerChain(params.chainId);

    let stored = params.stored;
    let mmDelegation: Delegation;

    if (stored) {
      mmDelegation = fromSignedDelegation(stored.delegation);
    } else if (params.permissionContext) {
      stored =
        (await this.findByPermissionContext(params.permissionContext)) ??
        undefined;
      mmDelegation = stored
        ? fromSignedDelegation(stored.delegation)
        : firstDelegationFromContext(params.permissionContext);
    } else {
      throw new Error(
        "cancelDelegation requires stored delegation or permissionContext",
      );
    }

    const { environment } = await this.createSmartAccount(
      params.chainId,
      EVMAccountAddress(getAddress(mmDelegation.delegator)),
    );

    const disableCalldata = DelegationManager.encode.disableDelegation({
      delegation: mmDelegation,
    }) as Hex;

    const result = await this.options.transactionUtils.sendViaRelayer({
      chainId: params.chainId,
      work: {
        to: EVMAccountAddress(getAddress(environment.DelegationManager)),
        data: HexString(disableCalldata),
        value: 0n,
      },
      paymentToken: params.paymentToken,
      feeAtoms: params.feeAtoms,
      relayerUrl: chain.relayerUrl,
      prefetchRelayerVaultAssertion: true,
      retainDisplayDuringSubmit: true,
      onAwaitingConfirmation: params.onAwaitingConfirmation,
    });

    let deletedDelegationId: ICancelDelegationResult["deletedDelegationId"];
    if (stored) {
      await this.options.delegationRepository.deleteDelegation(
        stored.delegationId,
      );
      deletedDelegationId = stored.delegationId;
    }

    return { ...result, deletedDelegationId };
  }

  async getSupportedExecutionPermissions(): Promise<SupportedExecutionPermissions> {
    const chains = await this.options.chainRepository.list();
    const chainIds = chains.filter((c) => c.useRelayer).map((c) => c.chainId);
    return {
      [ERC20_TOKEN_PERIODIC]: {
        chainIds,
        // Accepted on the wire; period scope is what phase 1 enforces on-chain.
        ruleTypes: ["expiry"],
      },
    };
  }

  async getGrantedExecutionPermissions(): Promise<
    IExecutionPermissionResponse[]
  > {
    const summaries =
      await this.options.delegationRepository.listDelegations();
    const responses: IExecutionPermissionResponse[] = [];
    for (const summary of summaries) {
      const full = await this.options.delegationRepository.getDelegation(
        summary.delegationId,
      );
      if (full) {
        responses.push(full.permissionResponse);
      }
    }
    return responses;
  }

  async findByPermissionContext(
    permissionContext: HexString,
  ): Promise<IStoredDelegation | undefined> {
    try {
      const delegation = firstDelegationFromContext(permissionContext);
      const hash = HexString(hashDelegation(delegation));
      return this.options.delegationRepository.getDelegationByHash(hash);
    } catch {
      return this.options.delegationRepository.getDelegationByHash(
        permissionContext,
      );
    }
  }

  private assertPeriodicPermission(permission: IExecutionPermission): void {
    if (permission.type !== ERC20_TOKEN_PERIODIC) {
      throw new Error(
        `Unsupported execution permission type: ${permission.type}`,
      );
    }
  }

  private async requireRelayerChain(chainId: EVMChainId) {
    const chain = await this.options.chainRepository.get(chainId);
    if (!chain) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    if (!chain.useRelayer) {
      throw new Error(`Chain ${chainId} does not support the 1Shot relayer`);
    }
    return chain;
  }

  private async createSmartAccount(
    chainId: EVMChainId,
    eoa: EVMAccountAddress,
    viemAccountArg?: LocalAccount,
  ) {
    const viemAccount =
      viemAccountArg ??
      (await this.options.transactionUtils.getViemAccount(eoa));
    const publicClient = this.options.blockchain.getPublicClient(chainId);
    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient as never,
      implementation: Implementation.Stateless7702,
      address: eoa,
      signer: { account: viemAccount },
    });
    return {
      smartAccount,
      environment: smartAccount.environment,
      viemAccount,
    };
  }
}

type Erc20PeriodData = {
  tokenAddress: EVMAccountAddress;
  periodAmount: bigint;
  periodDuration: number;
  startDate?: number;
  justification?: string;
};

function parseErc20PeriodData(
  data: Record<string, unknown>,
): Erc20PeriodData {
  const tokenRaw = data.tokenAddress ?? data.token;
  if (typeof tokenRaw !== "string") {
    throw new Error("erc20-token-periodic requires tokenAddress");
  }
  const amountRaw = data.periodAmount ?? data.amount;
  if (amountRaw === undefined || amountRaw === null) {
    throw new Error("erc20-token-periodic requires periodAmount");
  }
  const durationRaw = data.periodDuration ?? data.period ?? data.duration;
  if (typeof durationRaw !== "number" && typeof durationRaw !== "string") {
    throw new Error("erc20-token-periodic requires periodDuration");
  }
  const startRaw = data.startDate ?? data.start;
  return {
    tokenAddress: EVMAccountAddress(getAddress(tokenRaw as `0x${string}`)),
    periodAmount: toBigIntAmount(amountRaw),
    periodDuration: Number(durationRaw),
    ...(typeof startRaw === "number" || typeof startRaw === "string"
      ? { startDate: Number(startRaw) }
      : {}),
    ...(typeof data.justification === "string"
      ? { justification: data.justification }
      : {}),
  };
}

function toBigIntAmount(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error(`Invalid periodAmount: ${String(value)}`);
}

function toSignedDelegation(delegation: Delegation): ISignedDelegation {
  return {
    delegate: EVMAccountAddress(getAddress(delegation.delegate)),
    delegator: EVMAccountAddress(getAddress(delegation.delegator)),
    authority: HexString(delegation.authority),
    caveats: delegation.caveats.map((c) => ({
      enforcer: EVMContractAddress(getAddress(c.enforcer)),
      terms: HexString(c.terms),
      args: HexString(c.args),
    })),
    salt: HexString(delegation.salt as `0x${string}`),
    signature: HexString(delegation.signature),
  };
}

function fromSignedDelegation(stored: ISignedDelegation): Delegation {
  return {
    delegate: getAddress(stored.delegate),
    delegator: getAddress(stored.delegator),
    authority: stored.authority as Hex,
    caveats: stored.caveats.map((c) => ({
      enforcer: getAddress(c.enforcer),
      terms: c.terms as Hex,
      args: c.args as Hex,
    })),
    salt: stored.salt as Hex,
    signature: stored.signature as Hex,
  };
}

function firstDelegationFromContext(permissionContext: HexString): Delegation {
  const decoded = decodeDelegations(permissionContext as Hex);
  if (!decoded.length) {
    throw new Error("permissionContext contains no delegations");
  }
  return decoded[0]!;
}

function grantPermissionCeremony(): CeremonyUiParams {
  const prompts = styleController.get().copy.passkeyPrompt;
  return {
    explanationHeader: prompts.approveTransaction.title,
    explanationText:
      "Confirm with your passkey to grant this spending permission.",
  };
}

function randomSalt32(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")}` as Hex;
}
