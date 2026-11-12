import type {
  IBlockchainProvider,
  OWSWallet,
} from "@1shotapi/ows-wallet-utils";
import {
  ChainUtils,
  EVMChainId,
  EVMContractAddress,
  HexString,
  OwsInvalidParamsError,
  OwsRpcError,
  RelayerTransactionId,
  type EVMAccountAddress,
} from "@1shotapi/ows-types";
import { getSmartAccountsEnvironment } from "@metamask/smart-accounts-kit";
import type { Hex } from "viem";
import { z } from "zod";

import {
  MAX_CALLS_PER_BUNDLE,
  RPC_ERROR_BUNDLE_TOO_LARGE,
  RPC_ERROR_DUPLICATE_ID,
  RPC_ERROR_UNAUTHORIZED,
  RPC_ERROR_UNKNOWN_BUNDLE_ID,
  RPC_ERROR_UNSUPPORTED_CAPABILITY,
  RPC_ERROR_UNSUPPORTED_CHAIN,
  WALLET_CALLS_VERSION,
} from "../lib/eip5792/constants";
import {
  callsStatusFromRelayer,
  eipStatusFromReceipt,
  filterCallsReceiptLogs,
  toCallsReceipt,
  type ICallsReceipt,
  type ICallsStatusCode,
} from "../lib/eip5792/receipt";
import {
  callsBundleIdSchema,
  getCapabilitiesParamsSchema,
  randomBundleId,
  sendCallsParamsSchema,
  unsupportedCapabilityName,
  type IParsedSendCallsParams,
} from "../lib/eip5792/schema";
import type {
  ITransactionService,
  ITransactionWork,
} from "../lib/interfaces/business/ITransactionService";
import type { IChainRepository } from "../lib/interfaces/data/IChainRepository";
import type { IKnownAssetRepository } from "../lib/interfaces/data/IKnownAssetRepository";
import type { IOneshotRelayerRepository } from "../lib/interfaces/data/IOneshotRelayerRepository";
import type { ITrackedAssetRepository } from "../lib/interfaces/data/ITrackedAssetRepository";
import type { ITransactionUtils } from "../lib/interfaces/utils/ITransactionUtils";
import type { IHostOriginProvider } from "../lib/interfaces/utils/IHostOriginProvider";
import {
  CallBundleRepository,
  type IStoredCallBundle,
} from "../lib/implementations/data/CallBundleRepository";
import type { IRelayerSendUiCallbacks } from "../lib/types/domain/RelayerSendUi";
import type { AccountConnectStorage } from "../ows/registerAccountConnect";
import type {
  IRelayerConfirmSendResult,
  ISendCallsModalCall,
} from "./modalTypes";

type DisplaySession = {
  hide: () => Promise<void>;
  release?: () => void;
};

export type RegisterWalletCallsOptions = {
  storage: AccountConnectStorage;
  hostOriginProvider: IHostOriginProvider;
  chainRepository: IChainRepository;
  transactionService: ITransactionService;
  transactionUtils: ITransactionUtils;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  relayerRepository: IOneshotRelayerRepository;
  blockchain: IBlockchainProvider;
  ensureOnboardedForSigning: () => Promise<void>;
  bundles?: CallBundleRepository;
  ask: <T>(
    build: (handlers: {
      id: string;
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }) => import("./modalTypes").ActiveModal,
  ) => Promise<T>;
};

function parseParams<T>(schema: z.ZodType<T>, params: unknown): T {
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    throw new OwsInvalidParamsError("Invalid params", parsed.error.flatten());
  }
  return parsed.data;
}

function requireRequesterOrigin(
  hostOriginProvider: IHostOriginProvider,
): string {
  const origin = hostOriginProvider.getHostOrigin();
  if (!origin) {
    throw new OwsRpcError(
      "The requested account is not connected",
      RPC_ERROR_UNAUTHORIZED,
    );
  }
  return origin;
}

function requireSessionAccount(
  storage: AccountConnectStorage,
  requested?: EVMAccountAddress,
): EVMAccountAddress {
  if (!storage.loadAccountsPermissionGranted()) {
    throw new OwsRpcError(
      "The requested account is not connected",
      RPC_ERROR_UNAUTHORIZED,
    );
  }
  const account = storage.loadCachedEvmAddress();
  if (!account) {
    throw new OwsRpcError(
      "The requested account is not connected",
      RPC_ERROR_UNAUTHORIZED,
    );
  }
  if (requested && requested.toLowerCase() !== account.toLowerCase()) {
    throw new OwsRpcError(
      "The requested account is not connected",
      RPC_ERROR_UNAUTHORIZED,
    );
  }
  return account;
}

function rejectUnsupportedCapabilities(
  capabilities: Record<string, { optional?: boolean } | undefined> | undefined,
): void {
  const name = unsupportedCapabilityName(capabilities);
  if (!name) return;
  throw new OwsRpcError(
    `Unsupported non-optional capability: ${name}`,
    RPC_ERROR_UNSUPPORTED_CAPABILITY,
  );
}

async function releaseDisplay(display: DisplaySession): Promise<void> {
  if (typeof display.release === "function") {
    display.release();
    return;
  }
  await display.hide();
}

function delegationManagerAddress(chainId: EVMChainId): string | undefined {
  try {
    const env = getSmartAccountsEnvironment(Number(BigInt(chainId)));
    return env.DelegationManager;
  } catch {
    return undefined;
  }
}

function statusResult(
  bundle: IStoredCallBundle,
  status: ICallsStatusCode,
): {
  version: typeof WALLET_CALLS_VERSION;
  id: string;
  chainId: EVMChainId;
  status: ICallsStatusCode;
  atomic: true;
  receipts?: ICallsReceipt[];
} {
  return {
    version: WALLET_CALLS_VERSION,
    id: bundle.id,
    chainId: EVMChainId(bundle.chainId as `0x${string}`),
    status,
    atomic: true,
    ...(bundle.receipt ? { receipts: [bundle.receipt] } : {}),
  };
}

/**
 * EIP-5792 wallet call RPCs. Execution is the existing multi-call relayer
 * send; these handlers add consent, bundle ids, and status.
 */
export function registerWalletCalls(
  wallet: OWSWallet,
  options: RegisterWalletCallsOptions,
): void {
  const bundles = options.bundles ?? new CallBundleRepository();

  const loadStatus = async (
    id: string,
  ): Promise<ReturnType<typeof statusResult>> => {
    const account = requireSessionAccount(options.storage);
    const origin = requireRequesterOrigin(options.hostOriginProvider);
    const bundle = await bundles.get(origin, account, id);
    if (!bundle || !bundle.relayerTransactionId) {
      throw new OwsRpcError("Unknown bundle id", RPC_ERROR_UNKNOWN_BUNDLE_ID);
    }
    const taskId = bundle.relayerTransactionId;
    if (
      bundle.terminalStatus === 200 ||
      bundle.terminalStatus === 400 ||
      bundle.terminalStatus === 500
    ) {
      return statusResult(bundle, bundle.terminalStatus);
    }

    const relayerStatus = await options.relayerRepository.getStatus(
      bundle.relayerUrl,
      RelayerTransactionId(taskId as `0x${string}`),
    );
    const mapped = callsStatusFromRelayer(relayerStatus.status);
    if (mapped === 400 || mapped === 500) {
      bundle.terminalStatus = mapped;
      await bundles.put(bundle);
      return statusResult(bundle, mapped);
    }
    if (mapped === 100 || !relayerStatus.hash) {
      return statusResult(bundle, 100);
    }

    try {
      const chainId = EVMChainId(bundle.chainId as `0x${string}`);
      const receipt = await options.blockchain
        .getPublicClient(chainId)
        .getTransactionReceipt({ hash: relayerStatus.hash as Hex });
      const interpreted = eipStatusFromReceipt(receipt.status);
      if (!bundle.feeCollector && bundle.feeToken) {
        try {
          const capabilities = await options.relayerRepository.getCapabilities(
            bundle.relayerUrl,
            chainId,
          );
          bundle.feeCollector = capabilities.feeCollector;
        } catch {
          bundle.feeCollector = "";
        }
      }
      const logs = filterCallsReceiptLogs(receipt.logs, {
        delegationManager: delegationManagerAddress(chainId),
        feeToken: bundle.feeToken,
        feeCollector: bundle.feeCollector,
      });
      bundle.receipt = toCallsReceipt(receipt, logs, interpreted.receiptStatus);
      bundle.terminalStatus = interpreted.status;
      await bundles.put(bundle);
      return statusResult(bundle, interpreted.status);
    } catch {
      return statusResult(bundle, 100);
    }
  };

  wallet.registerEip1193("wallet_getCapabilities", async (params) => {
    requireRequesterOrigin(options.hostOriginProvider);
    const parsed = parseParams(getCapabilitiesParamsSchema, params);
    const requested = parsed.length > 0 ? parsed[0] : undefined;
    const account = requireSessionAccount(options.storage, requested);
    const chainFilter =
      parsed.length === 2
        ? new Set(parsed[1].map((chainId) => chainId.toLowerCase()))
        : null;

    const chains = options.chainRepository.getCatalog().filter((chain) => {
      if (!chain.enabled || !chain.useRelayer) return false;
      if (!ChainUtils.isEVMChainId(chain.chainId)) return false;
      if (
        chainFilter &&
        !chainFilter.has(String(chain.chainId).toLowerCase())
      ) {
        return false;
      }
      return true;
    });

    const entries = await Promise.all(
      chains.map(async (chain) => {
        const chainId = chain.chainId as EVMChainId;
        let status: "supported" | "ready" = "ready";
        try {
          const upgrade =
            await options.transactionService.getWalletUpgradeStatus(
              chainId,
              account,
            );
          status = upgrade.upgraded ? "supported" : "ready";
        } catch {
          status = "ready";
        }
        return [String(chainId), { atomic: { status } }] as const;
      }),
    );

    return Object.fromEntries(entries);
  });

  wallet.registerEip1193("wallet_getCallsStatus", async (params) => {
    const [id] = parseParams(callsBundleIdSchema, params);
    return loadStatus(id);
  });

  wallet.registerEip1193("wallet_showCallsStatus", async (params) => {
    const [id] = parseParams(callsBundleIdSchema, params);
    const status = await loadStatus(id);
    const account = requireSessionAccount(options.storage);
    const origin = requireRequesterOrigin(options.hostOriginProvider);
    const bundle = await bundles.get(origin, account, id);
    if (!bundle) {
      throw new OwsRpcError("Unknown bundle id", RPC_ERROR_UNKNOWN_BUNDLE_ID);
    }
    const chain = await options.chainRepository.get(status.chainId);
    const display = await wallet.requestDisplay();
    try {
      await options.ask<null>(({ id: modalId, resolve }) => ({
        id: modalId,
        kind: "showCallsStatus",
        request: {
          bundleId: bundle.id,
          chainName: chain?.label ?? String(status.chainId),
          status: status.status,
          calls: bundle.calls,
          transactionHash: status.receipts?.[0]?.transactionHash,
        },
        resolve,
      }));
      return null;
    } finally {
      await releaseDisplay(display);
    }
  });

  wallet.registerEip1193("wallet_sendCalls", async (params) => {
    const [body] = parseParams(sendCallsParamsSchema, params) as [
      IParsedSendCallsParams,
    ];
    rejectUnsupportedCapabilities(body.capabilities);
    for (const call of body.calls) {
      rejectUnsupportedCapabilities(call.capabilities);
    }
    if (body.calls.length > MAX_CALLS_PER_BUNDLE) {
      throw new OwsRpcError(
        `Call bundle exceeds ${MAX_CALLS_PER_BUNDLE} calls`,
        RPC_ERROR_BUNDLE_TOO_LARGE,
      );
    }

    const account = requireSessionAccount(options.storage, body.from);
    const chain = await options.chainRepository.get(body.chainId);
    if (
      !chain ||
      !chain.enabled ||
      !chain.useRelayer ||
      !ChainUtils.isEVMChainId(chain.chainId)
    ) {
      throw new OwsRpcError(
        "Unsupported chain id",
        RPC_ERROR_UNSUPPORTED_CHAIN,
      );
    }

    const origin = requireRequesterOrigin(options.hostOriginProvider);
    const bundleId = body.id ?? randomBundleId();
    const existing = await bundles.get(origin, account, bundleId);
    if (existing) {
      throw new OwsRpcError("Duplicate bundle id", RPC_ERROR_DUPLICATE_ID);
    }
    await bundles.put({
      id: bundleId,
      origin,
      account,
      chainId: String(body.chainId),
      relayerUrl: chain.relayerUrl,
      calls: [],
      feeToken: "",
      feeCollector: "",
      atomic: true,
      createdAt: Date.now(),
    });
    let submitted = false;
    try {
      const work: ITransactionWork[] = body.calls.map((call) => {
        const rawValue = call.value ? String(call.value).toLowerCase() : "";
        const value =
          rawValue && rawValue !== "0x" && rawValue !== "0x0"
            ? BigInt(rawValue)
            : undefined;
        return {
          to: call.to,
          data: call.data ?? HexString("0x"),
          ...(value !== undefined ? { value } : {}),
        };
      });

      const trackedAssets = await options.trackedAssetRepository.list(
        body.chainId,
      );
      const calls = await Promise.all(
        body.calls.map(async (call) => {
          const data = call.data ?? HexString("0x");
          const decoded = options.transactionUtils.tryDecodeErc20Transfer(
            EVMContractAddress(call.to),
            data,
          );
          let transfer: ISendCallsModalCall["transfer"];
          if (decoded) {
            const known = await options.knownAssetRepository.getKnownAsset(
              body.chainId,
              decoded.tokenAddress,
            );
            const tracked = trackedAssets.find(
              (asset) => asset.address === decoded.tokenAddress,
            );
            const decimals = tracked?.decimals ?? known?.decimals;
            const symbol = tracked?.symbol ?? known?.symbol;
            if (decimals != null && symbol) {
              const iconUrl = tracked?.iconUrl ?? known?.iconUrl;
              transfer = {
                tokenAddress: decoded.tokenAddress,
                symbol,
                amount: options.transactionUtils.formatTokenAmount(
                  decoded.amount,
                  decimals,
                ),
                recipient: decoded.recipient,
                ...(iconUrl ? { iconUrl } : {}),
              };
            }
          }
          return {
            to: call.to,
            data,
            value: call.value ?? "0x0",
            ...(transfer ? { transfer } : {}),
          };
        }),
      );

      const display = await wallet.requestDisplay();
      try {
        await options.ensureOnboardedForSigning();
        let feeToken = "";
        let feeCollector = "";
        const taskId = await options.ask<string>(({ id, resolve, reject }) => ({
          id,
          kind: "sendCalls",
          request: {
            domain: String(options.transactionUtils.resolveHostDomain()),
            account,
            chainId: body.chainId,
            chainName: chain.label,
            calls,
            work,
          },
          execute: async (
            payment: IRelayerConfirmSendResult,
            ui?: IRelayerSendUiCallbacks,
          ) => {
            const submitted = await options.transactionService.sendCalls(
              body.chainId,
              work,
              {
                paymentToken: payment.paymentToken,
                feeAtoms: payment.feeAtoms,
                paymentChainId: payment.paymentChainId,
                ...ui,
              },
            );
            feeToken = payment.paymentToken;
            try {
              const feeChain = await options.chainRepository.get(
                payment.paymentChainId,
              );
              if (feeChain) {
                const capabilities =
                  await options.relayerRepository.getCapabilities(
                    feeChain.relayerUrl,
                    payment.paymentChainId,
                  );
                feeCollector = capabilities.feeCollector;
              }
            } catch {
              feeCollector = "";
            }
            return submitted.relayerTransactionId;
          },
          resolve,
          reject,
        }));

        const current = await bundles.get(origin, account, bundleId);
        if (
          current?.relayerTransactionId &&
          current.relayerTransactionId !== taskId
        ) {
          throw new OwsRpcError("Duplicate bundle id", RPC_ERROR_DUPLICATE_ID);
        }
        await bundles.put({
          id: bundleId,
          origin,
          account,
          chainId: String(body.chainId),
          relayerUrl: chain.relayerUrl,
          relayerTransactionId: taskId,
          calls: calls.map((call) => ({
            to: call.to,
            data: call.data,
            value: call.value,
          })),
          feeToken,
          feeCollector,
          atomic: true,
          createdAt: Date.now(),
        });
        submitted = true;
        return { id: bundleId };
      } finally {
        await releaseDisplay(display);
      }
    } finally {
      if (!submitted) {
        const current = await bundles.get(origin, account, bundleId);
        if (current && !current.relayerTransactionId) {
          await bundles.remove(origin, account, bundleId);
        }
      }
    }
  });
}
