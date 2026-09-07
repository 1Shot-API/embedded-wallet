import {
  createCaveat,
  createDelegation,
  Implementation,
  ROOT_AUTHORITY,
  ScopeType,
  toMetaMaskSmartAccount,
  type Delegation,
  type SmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";
import { DelegationManager } from "@metamask/smart-accounts-kit/contracts";
import {
  createCaveatBuilder,
  decodeDelegations,
  encodeDelegations,
  hashDelegation,
} from "@metamask/smart-accounts-kit/utils";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import {
  ConversionUtils,
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
import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isHex,
  type Hex,
} from "viem";
import type { LocalAccount } from "viem/accounts";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type { IDelegationRepository } from "../../interfaces/data/IDelegationRepository";
import type {
  ICancelDelegationParams,
  ICancelDelegationResult,
  ICreateExecutionPermissionsParams,
  IDelegationService,
} from "../../interfaces/business/IDelegationService";
import {
  ERC20_TOKEN_PERIODIC,
  LIFI_SWAP_APPROVE,
  LIFI_SWAP_PERIODIC,
} from "../../interfaces/business/IDelegationService";
import type { ITransactionUtils } from "../../interfaces/business/utils/ITransactionUtils";
import type { ILiFiUtils } from "../../interfaces/business/utils/ILiFiUtils";
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

/**
 * MetaMask StatelessDelegator grants + on-chain disable via public relayer.
 */
export class DelegationService implements IDelegationService {
  constructor(
    protected readonly chainRepository: IChainRepository,
    protected readonly delegationRepository: IDelegationRepository,
    protected readonly blockchain: IBlockchainProvider,
    protected readonly transactionUtils: ITransactionUtils,
    protected readonly presentationTransactionUtils: IPresentationTransactionUtils,
    protected readonly owsProvider: IOWSProvider,
    protected readonly liFiUtils: ILiFiUtils,
  ) {}

  async createExecutionPermissions(
    params: ICreateExecutionPermissionsParams,
  ): Promise<IStoredDelegation[]> {
    const { items, onDelegationsSigned } = params;
    if (items.length === 0) {
      return [];
    }

    for (const item of items) {
      this.assertSupportedPermission(item.permission, item.request.chainId);
      await this.requireRelayerChain(item.request.chainId);
    }

    const signer = await this.owsProvider.getSigner();
    const eoa =
      items[0]!.request.from ??
      signer.getCachedAddress?.() ??
      loadCachedEvmAddress() ??
      (await signer.evm.getAccountAddress());

    const smartAccountByChain = new Map<
      string,
      Awaited<ReturnType<DelegationService["createSmartAccount"]>>
    >();
    const getSmartAccount = async (chainId: EVMChainId) => {
      const key = String(chainId).toLowerCase();
      let cached = smartAccountByChain.get(key);
      if (!cached) {
        await this.transactionUtils.needsWalletUpgrade(chainId, eoa);
        cached = await this.createSmartAccount(chainId, eoa);
        smartAccountByChain.set(key, cached);
      }
      return cached;
    };

    // Warm smart accounts / upgrade cache for every chain in the batch.
    for (const item of items) {
      await getSmartAccount(item.request.chainId);
    }

    await this.owsProvider.ensureDisplay();
    try {
      const grantCopy = grantPermissionsCeremony(
        items.map((item) => item.permission.type),
      );
      const signedDelegations = await withCeremonyUiReason(
        EPasskeyPromptReason.ApproveTransaction,
        () =>
          withCoalescedSignDigest(
            signer,
            grantCopy,
            () =>
              Promise.all(
                items.map(async (item) => {
                  const { smartAccount, environment } = await getSmartAccount(
                    item.request.chainId,
                  );
                  const unsigned = this.buildUnsignedDelegation({
                    permission: item.permission,
                    requestTo: item.request.to,
                    smartAccountAddress: EVMAccountAddress(
                      getAddress(smartAccount.address),
                    ),
                    environment,
                    salt: randomSalt32(),
                    chainId: item.request.chainId,
                  });
                  const signature = await smartAccount.signDelegation({
                    delegation: unsigned,
                  });
                  return { ...unsigned, signature } satisfies Delegation;
                }),
              ),
            { minCalls: items.length },
          ),
      );

      await onDelegationsSigned?.();

      const hostRaw =
        this.presentationTransactionUtils.resolveHostDomain();
      const hostDomain = DomainString(
        hostRaw === "the connected app" ? "unknown" : hostRaw,
      );
      const createdAt = UnixTimestamp(Math.floor(Date.now() / 1000));

      const storedList: IStoredDelegation[] = items.map((item, index) => {
        const signedDelegation = signedDelegations[index]!;
        const { environment } = smartAccountByChain.get(
          String(item.request.chainId).toLowerCase(),
        )!;
        const delegationForHash: Delegation = {
          ...signedDelegation,
          caveats: signedDelegation.caveats.map((c) => ({
            ...c,
            args: (c.args ?? "0x") as Hex,
          })),
        };
        const delegationHash = HexString(hashDelegation(delegationForHash));
        const context = HexString(
          encodeDelegations([signedDelegation]) as `0x${string}`,
        );
        const delegationManager = EVMContractAddress(
          getAddress(environment.DelegationManager),
        );
        const attenuatedPermission = this.buildAttenuatedPermission(
          item.permission,
          delegationHash,
        );
        const permissionResponse: IExecutionPermissionResponse = {
          chainId: item.request.chainId,
          from: eoa,
          to: item.request.to,
          permission: attenuatedPermission,
          ...(item.request.rules ? { rules: item.request.rules } : {}),
          context,
          dependencies: [],
          delegationManager,
        };
        return {
          delegationId: makeDelegationId(String(delegationHash)),
          delegationHash,
          chainId: item.request.chainId,
          hostDomain,
          memo: item.memo.trim(),
          createdAt,
          delegation: toSignedDelegation(signedDelegation),
          permissionResponse,
        };
      });

      await this.delegationRepository.storeDelegations(storedList);
      return storedList;
    } finally {
      await this.owsProvider.hideDisplay();
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

    const result = await this.transactionUtils.sendViaRelayer({
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
      onFinalFeeRequired: params.onFinalFeeRequired,
    });

    let deletedDelegationId: ICancelDelegationResult["deletedDelegationId"];
    if (stored) {
      await this.delegationRepository.deleteDelegation(
        stored.delegationId,
      );
      deletedDelegationId = stored.delegationId;
    }

    return { ...result, deletedDelegationId };
  }

  async getSupportedExecutionPermissions(): Promise<SupportedExecutionPermissions> {
    const chains = await this.chainRepository.list();
    const relayerChainIds = chains
      .filter((c) => c.useRelayer)
      .map((c) => c.chainId);
    const lifiChainIds = relayerChainIds.filter(
      (id) => this.liFiUtils.resolveSwapEnforcer(id) !== null,
    );
    return {
      [ERC20_TOKEN_PERIODIC]: {
        chainIds: relayerChainIds,
        // Accepted on the wire; period scope is what phase 1 enforces on-chain.
        ruleTypes: ["expiry"],
      },
      [LIFI_SWAP_PERIODIC]: {
        chainIds: lifiChainIds,
        ruleTypes: ["expiry"],
      },
      [LIFI_SWAP_APPROVE]: {
        chainIds: lifiChainIds,
        ruleTypes: ["expiry"],
      },
    };
  }

  async getGrantedExecutionPermissions(): Promise<
    IExecutionPermissionResponse[]
  > {
    const summaries =
      await this.delegationRepository.listDelegations();
    const responses: IExecutionPermissionResponse[] = [];
    for (const summary of summaries) {
      const full = await this.delegationRepository.getDelegation(
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
      return this.delegationRepository.getDelegationByHash(hash);
    } catch {
      return this.delegationRepository.getDelegationByHash(
        permissionContext,
      );
    }
  }

  private assertSupportedPermission(
    permission: IExecutionPermission,
    chainId: EVMChainId,
  ): void {
    if (permission.type === ERC20_TOKEN_PERIODIC) return;
    if (
      permission.type === LIFI_SWAP_PERIODIC ||
      permission.type === LIFI_SWAP_APPROVE
    ) {
      if (this.liFiUtils.resolveSwapEnforcer(chainId) === null) {
        throw new Error(
          `LiFi swap permissions are not supported on chain ${chainId}`,
        );
      }
      return;
    }
    throw new Error(
      `Unsupported execution permission type: ${permission.type}`,
    );
  }

  private buildUnsignedDelegation(args: {
    permission: IExecutionPermission;
    requestTo: EVMAccountAddress;
    smartAccountAddress: EVMAccountAddress;
    environment: SmartAccountsEnvironment;
    salt: Hex;
    chainId: EVMChainId;
  }): Delegation {
    const { permission, requestTo, smartAccountAddress, environment, salt } =
      args;

    if (permission.type === ERC20_TOKEN_PERIODIC) {
      const period = parseErc20PeriodData(permission.data);
      const startDate = period.startDate ?? Math.floor(Date.now() / 1000);
      return createDelegation({
        to: getAddress(requestTo),
        from: getAddress(smartAccountAddress),
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
    }

    if (permission.type === LIFI_SWAP_PERIODIC) {
      const swap = parseLiFiSwapData(
        permission.data,
        this.liFiUtils.defaultSlippageBps,
      );
      const enforcer = this.liFiUtils.resolveSwapEnforcer(args.chainId);
      if (!enforcer) {
        throw new Error(
          `No LiFiSwapEnforcer deployed for chain ${args.chainId}`,
        );
      }
      const termsBytes = this.liFiUtils.encodeTerms({
        lifiDiamond: getAddress(swap.lifiDiamond),
        inputToken: getAddress(swap.tokenAddress),
        outputAssetId: swap.outputAssetId,
        outputRecipient: swap.outputRecipient,
        destinationChainId: swap.destinationChainId,
        quoteSigner: getAddress(swap.quoteSigner),
        periodAmount: swap.periodAmount,
        periodDuration: BigInt(swap.periodDuration),
        startDate: BigInt(swap.startDate),
        slippageBps: BigInt(swap.slippageBps),
      });
      const caveats = buildSwapCaveats(
        environment,
        getAddress(swap.lifiDiamond),
        getAddress(enforcer),
        termsBytes as Hex,
      );
      return {
        delegate: getAddress(requestTo),
        delegator: getAddress(smartAccountAddress),
        authority: ROOT_AUTHORITY,
        caveats: caveats.map((c) => ({ ...c, args: (c.args ?? "0x") as Hex })),
        salt,
        signature: "0x",
      };
    }

    if (permission.type === LIFI_SWAP_APPROVE) {
      const approve = parseLiFiApproveData(permission.data);
      const caveats = buildApproveCaveats(
        environment,
        getAddress(approve.tokenAddress),
        getAddress(approve.spender),
        ConversionUtils.addressToBytes32Hex(
          getAddress(approve.spender),
        ) as Hex,
      );
      return {
        delegate: getAddress(requestTo),
        delegator: getAddress(smartAccountAddress),
        authority: ROOT_AUTHORITY,
        caveats: caveats.map((c) => ({ ...c, args: (c.args ?? "0x") as Hex })),
        salt,
        signature: "0x",
      };
    }

    throw new Error(
      `Unsupported execution permission type: ${permission.type}`,
    );
  }

  private buildAttenuatedPermission(
    permission: IExecutionPermission,
    delegationHash: HexString,
  ): IExecutionPermission {
    if (permission.type === ERC20_TOKEN_PERIODIC) {
      const period = parseErc20PeriodData(permission.data);
      const startDate = period.startDate ?? Math.floor(Date.now() / 1000);
      return {
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
    }

    if (permission.type === LIFI_SWAP_PERIODIC) {
      const swap = parseLiFiSwapData(
        permission.data,
        this.liFiUtils.defaultSlippageBps,
      );
      return {
        type: LIFI_SWAP_PERIODIC,
        isAdjustmentAllowed: permission.isAdjustmentAllowed,
        data: {
          lifiDiamond: swap.lifiDiamond,
          tokenAddress: swap.tokenAddress,
          outputAssetId: swap.outputAssetId,
          outputRecipient: swap.outputRecipient,
          destinationChainId: swap.destinationChainId.toString(),
          quoteSigner: swap.quoteSigner,
          periodAmount: `0x${swap.periodAmount.toString(16)}`,
          periodDuration: swap.periodDuration,
          startDate: swap.startDate,
          slippageBps: swap.slippageBps,
          delegationHash,
        },
      };
    }

    if (permission.type === LIFI_SWAP_APPROVE) {
      const approve = parseLiFiApproveData(permission.data);
      return {
        type: LIFI_SWAP_APPROVE,
        isAdjustmentAllowed: permission.isAdjustmentAllowed,
        data: {
          tokenAddress: approve.tokenAddress,
          spender: approve.spender,
          delegationHash,
        },
      };
    }

    throw new Error(
      `Unsupported execution permission type: ${permission.type}`,
    );
  }

  private async requireRelayerChain(chainId: EVMChainId) {
    const chain = await this.chainRepository.get(chainId);
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
      (await this.transactionUtils.getViemAccount(eoa));
    const publicClient = this.blockchain.getPublicClient(chainId);
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

type LiFiSwapData = {
  lifiDiamond: EVMAccountAddress;
  tokenAddress: EVMAccountAddress;
  outputAssetId: Hex;
  outputRecipient: Hex;
  destinationChainId: bigint;
  quoteSigner: EVMAccountAddress;
  periodAmount: bigint;
  periodDuration: number;
  startDate: number;
  slippageBps: number;
};

type LiFiApproveData = {
  tokenAddress: EVMAccountAddress;
  spender: EVMAccountAddress;
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

export function parseLiFiSwapData(
  data: Record<string, unknown>,
  defaultSlippageBps: number,
): LiFiSwapData {
  const lifiDiamond = requireAddress(data.lifiDiamond, "lifiDiamond");
  const tokenAddress = requireAddress(
    data.tokenAddress ?? data.inputToken,
    "tokenAddress",
  );
  const outputAssetId = requireBytes32(data.outputAssetId, "outputAssetId");
  const outputRecipient = requireBytes32(
    data.outputRecipient,
    "outputRecipient",
  );
  const quoteSigner = requireAddress(data.quoteSigner, "quoteSigner");
  const amountRaw = data.periodAmount ?? data.amount;
  if (amountRaw === undefined || amountRaw === null) {
    throw new Error("lifi-swap-periodic requires periodAmount");
  }
  const durationRaw = data.periodDuration ?? data.period ?? data.duration;
  if (typeof durationRaw !== "number" && typeof durationRaw !== "string") {
    throw new Error("lifi-swap-periodic requires periodDuration");
  }
  const destRaw = data.destinationChainId;
  if (typeof destRaw !== "number" && typeof destRaw !== "string") {
    throw new Error("lifi-swap-periodic requires destinationChainId");
  }
  const startRaw = data.startDate ?? data.start;
  const startDate =
    typeof startRaw === "number" || typeof startRaw === "string"
      ? Number(startRaw)
      : Math.floor(Date.now() / 1000);
  const slippageRaw = data.slippageBps;
  const slippageBps =
    typeof slippageRaw === "number" || typeof slippageRaw === "string"
      ? Number(slippageRaw)
      : defaultSlippageBps;
  if (
    !Number.isFinite(slippageBps) ||
    slippageBps < 0 ||
    slippageBps >= 10_000 ||
    !Number.isInteger(slippageBps)
  ) {
    throw new Error("lifi-swap-periodic slippageBps must be an integer < 10000");
  }
  const periodDuration = Number(durationRaw);
  if (!Number.isFinite(periodDuration) || periodDuration < 1) {
    throw new Error("lifi-swap-periodic requires periodDuration >= 1");
  }

  return {
    lifiDiamond,
    tokenAddress,
    outputAssetId,
    outputRecipient,
    destinationChainId: BigInt(destRaw),
    quoteSigner,
    periodAmount: toBigIntAmount(amountRaw),
    periodDuration,
    startDate,
    slippageBps,
  };
}

export function parseLiFiApproveData(
  data: Record<string, unknown>,
): LiFiApproveData {
  return {
    tokenAddress: requireAddress(
      data.tokenAddress ?? data.inputToken,
      "tokenAddress",
    ),
    spender: requireAddress(data.spender ?? data.lifiDiamond, "spender"),
  };
}

function requireAddress(
  value: unknown,
  field: string,
): EVMAccountAddress {
  if (typeof value !== "string") {
    throw new Error(`${field} is required`);
  }
  return EVMAccountAddress(getAddress(value as `0x${string}`));
}

function requireBytes32(value: unknown, field: string): Hex {
  if (typeof value !== "string" || !isHex(value) || (value.length - 2) / 2 !== 32) {
    throw new Error(`${field} must be a 32-byte hex string`);
  }
  return value as Hex;
}

function toBigIntAmount(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string") return BigInt(value);
  throw new Error(`Invalid periodAmount: ${String(value)}`);
}

function buildSwapCaveats(
  environment: SmartAccountsEnvironment,
  lifiDiamond: Hex,
  enforcer: Hex,
  termsBytes: Hex,
) {
  return createCaveatBuilder(environment, {
    allowInsecureUnrestrictedDelegation: true,
  })
    .addCaveat("allowedTargets", { targets: [lifiDiamond] })
    .addCaveat("valueLte", { maxValue: 0n })
    .addCaveat(createCaveat(enforcer, termsBytes, "0x"))
    .build();
}

function buildApproveCaveats(
  environment: SmartAccountsEnvironment,
  inputToken: Hex,
  lifiDiamond: Hex,
  spenderBytes32: Hex,
) {
  const approveSelector = encodeFunctionData({
    abi: erc20Abi,
    functionName: "approve",
    args: [lifiDiamond, 0n],
  }).slice(0, 10) as Hex;

  return createCaveatBuilder(environment, {
    allowInsecureUnrestrictedDelegation: true,
  })
    .addCaveat("allowedTargets", { targets: [inputToken] })
    .addCaveat("allowedMethods", { selectors: [approveSelector] })
    .addCaveat("allowedCalldata", {
      startIndex: 4,
      value: spenderBytes32,
    })
    .addCaveat("valueLte", { maxValue: 0n })
    .build();
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

function grantPermissionsCeremony(
  permissionTypes: string[],
): CeremonyUiParams {
  const prompts = styleController.get().copy.passkeyPrompt;
  if (permissionTypes.length > 1) {
    return {
      explanationHeader: prompts.approveTransaction.title,
      explanationText:
        "Confirm with your passkey to grant these spending permissions.",
    };
  }
  const permissionType = permissionTypes[0] ?? "";
  const explanationText =
    permissionType === LIFI_SWAP_APPROVE
      ? "Confirm with your passkey to grant LiFi approve permission."
      : permissionType === LIFI_SWAP_PERIODIC
        ? "Confirm with your passkey to grant this LiFi swap permission."
        : "Confirm with your passkey to grant this spending permission.";
  return {
    explanationHeader: prompts.approveTransaction.title,
    explanationText,
  };
}

function randomSalt32(): Hex {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return `0x${Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("")}` as Hex;
}
