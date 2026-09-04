import { useEffect, type RefObject } from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type EVMChainId,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { InMemoryIssuerTrustRegistry } from "../demo/in-memory-trust-registry";
import type { CachedRelayerVaultRepository } from "../lib/implementations/data/CachedRelayerVaultRepository";
import {
  DemoWalletAttestationProvider,
  FetchUtils,
  HttpOid4vciClient,
  HttpOid4vpClient,
  ParseUtils,
} from "@1shotapi/ows-oid4";
import {
  registerAccountConnect,
  type AccountConnectStorage,
} from "../ows/registerAccountConnect";
import { registerApprovalSigning } from "../ows/registerApprovalSigning";
import { registerCredentialsProvider } from "../ows/registerCredentialsProvider";
import { registerConfigureRpc } from "../style/registerConfigure";
import { wrapSignerWithCeremonyCopy } from "./wrapSignerWithCeremonyCopy";
import { DEFAULT_CHAIN_ID } from "../lib/implementations/data/HardcodedChainRepository";
import {
  analyticsErrorCode,
  isAnalyticsCancelled,
  runWithAnalytics,
} from "../lib/implementations/utils";
import type {
  IChainRepository,
  IKnownAssetRepository,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type {
  IDelegationService,
  ITransactionService,
} from "../lib/interfaces/business";
import {
  ERC20_TOKEN_PERIODIC,
  LIFI_SWAP_APPROVE,
  LIFI_SWAP_PERIODIC,
} from "../lib/interfaces/business/IDelegationService";
import type {
  IConfigProvider,
  IEventBus,
  IOWSProvider,
  ISIWEUtils,
  ITransactionUtils,
} from "../lib/interfaces/utils";
import type { ICCTPUtils } from "../lib/interfaces/business/utils/ICCTPUtils";
import type { ILiFiUtils } from "../lib/interfaces/business/utils/ILiFiUtils";
import { SIWEUtils } from "../lib/implementations/utils/SIWEUtils";
import type { SupportedChain } from "../lib/types/domain";
import type { TokenAmount } from "../lib/types/primitives";
import {
  DelegationCancelAbortedEvent,
  DelegationCancelledEvent,
  DelegationCancelFailedEvent,
  DelegationCreateCancelledEvent,
  DelegationCreatedEvent,
  DelegationCreateFailedEvent,
  PersonalSignCancelledEvent,
  PersonalSignEvent,
  PersonalSignFailedEvent,
  TransactionSubmitCancelledEvent,
  TransactionSubmittedEvent,
  TransactionSubmitFailedEvent,
  TypedSignCancelledEvent,
  TypedSignEvent,
  TypedSignFailedEvent,
} from "../lib/types/events/productEvents";
import { registerAddAssetRpc } from "./registerAddAsset";
import { registerCreateAccountRpc } from "./registerCreateAccount";
import type { IPasskeyRegistrationResult } from "./registerCreateAccount";
import { registerFocusModeRpc } from "./registerFocusMode";
import { registerOnrampRpc } from "./registerOnramp";
import { registerBridgeRpc } from "./registerBridge";
import { loadCachedEvmAddress, loadCredentialId } from "../storage";
import { pushModal } from "./pushModal";
import type {
  ActiveModal,
  IGrantExecutionPermissionResult,
  IRelayerConfirmSendResult,
} from "./modalTypes";
import { useWalletSessionStore } from "./sessionStore";
import { DEMO_HOLDER_PRIVATE_JWK } from "../demo/demo-keys";

function analyticsAccountAddress(
  fallback?: EVMAccountAddress,
): EVMAccountAddress {
  return (
    fallback ??
    (useWalletSessionStore.getState().evmAddress ||
      loadCachedEvmAddress() ||
      EVMAccountAddress("0x0"))
  );
}

function analyticsMethodId(data: string | null | undefined): string | null {
  if (!data || data.length < 10) {
    return null;
  }
  return data.slice(0, 10);
}

function createDeferredSigner(
  awaitSigner: () => Promise<OWSSigner>,
): OWSSigner {
  let instance: OWSSigner | undefined;
  let loadError: unknown;
  void awaitSigner()
    .then((signer) => {
      instance = signer;
    })
    .catch((error: unknown) => {
      loadError = error;
      console.error(
        "[oneshot-wallet] deferred Signing Layer load failed",
        error,
      );
    });
  return new Proxy({} as OWSSigner, {
    get(_target, property) {
      if (property === "then") {
        return undefined;
      }
      if (!instance) {
        if (loadError !== undefined) {
          throw loadError instanceof Error
            ? loadError
            : new Error(
                `Signing Layer failed to load: ${String(loadError)}`,
              );
        }
        throw new Error(
          "Signing Layer not ready — await ensureReady() before using the signer",
        );
      }
      const value = Reflect.get(instance, property, instance);
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(instance)
        : value;
    },
  });
}

function requireRelayerConfirmPayment(confirmed: {
  paymentToken?: EVMAccountAddress;
  feeAtoms?: TokenAmount;
}): IRelayerConfirmSendResult {
  if (!confirmed.paymentToken || confirmed.feeAtoms === undefined) {
    throw new OwsInvalidParamsError(
      "Select a relayer payment token and fee before confirming the transaction",
    );
  }
  return {
    paymentToken: confirmed.paymentToken,
    feeAtoms: confirmed.feeAtoms,
  };
}

export interface IUseWalletBootParams {
  signerContainerRef: RefObject<HTMLDivElement | null>;
  walletRef: RefObject<OWSWallet | null>;
  signerRef: RefObject<OWSSigner | null>;
  rpcHelperRef: RefObject<RpcHelper | null>;
  awaitSignerRef: RefObject<(() => Promise<OWSSigner>) | null>;
  ensureReadyRef: RefObject<() => Promise<void>>;
  ensureReady: () => Promise<void>;
  ensureOnboardedForSigning: () => Promise<void>;
  onSigningAuthenticated: () => Promise<void>;
  createNewWallet: (accountName: string) => Promise<void>;
  createNewWalletFromUi: () => Promise<void>;
  createPasskeyRegistrationOnly: (
    accountName?: string,
  ) => Promise<IPasskeyRegistrationResult>;
  resolveChain: (chainId: EVMChainId) => SupportedChain | null;
  owsProvider: IOWSProvider;
  chainRepository: IChainRepository;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  transactionService: ITransactionService;
  delegationService: IDelegationService;
  transactionUtils: ITransactionUtils;
  cctpUtils: ICCTPUtils;
  liFiUtils: ILiFiUtils;
  credentialRepository: CachedRelayerVaultRepository;
  walletStorage: AccountConnectStorage;
  eventBus: IEventBus;
  configProvider: IConfigProvider;
}

const siweUtils: ISIWEUtils = new SIWEUtils();

export function useWalletBoot({
  signerContainerRef,
  walletRef,
  signerRef,
  rpcHelperRef,
  awaitSignerRef,
  ensureReadyRef: _ensureReadyRef,
  ensureReady,
  ensureOnboardedForSigning,
  onSigningAuthenticated,
  createNewWallet,
  createNewWalletFromUi,
  createPasskeyRegistrationOnly,
  resolveChain,
  owsProvider,
  chainRepository,
  knownAssetRepository,
  trackedAssetRepository,
  transactionService,
  delegationService,
  transactionUtils,
  cctpUtils,
  liFiUtils,
  credentialRepository,
  walletStorage,
  eventBus,
  configProvider,
}: IUseWalletBootParams): void {
  useEffect(() => {
    let cancelled = false;
    let chainEvents: RpcHelper["events"] | undefined;
    const onChainChanged = (next: EVMChainId) => {
      useWalletSessionStore.getState().setChainId(next);
      walletRef.current?.providerEvents.emit("chainChanged", next);
    };
    const session = useWalletSessionStore.getState();

    const issuerTrust = new InMemoryIssuerTrustRegistry();
    const fetchUtils = new FetchUtils();
    const parseUtils = new ParseUtils();
    const oid4vci = new HttpOid4vciClient(fetchUtils, parseUtils);
    const oid4vp = new HttpOid4vpClient(fetchUtils);
    const attestationProvider = new DemoWalletAttestationProvider({
      privateJwk: DEMO_HOLDER_PRIVATE_JWK,
      issuer: "ows-demo-wallet",
    });

    async function boot(): Promise<void> {
      await Promise.resolve();
      const container = signerContainerRef.current;
      if (!container) {
        throw new Error("#signer-container not mounted");
      }

      const signerUrl = new URL("/signer/", window.location.origin).href;
      const signerPromise = OWSSigner.create(container, signerUrl, {
        hidden: true,
        credentialId: loadCredentialId(),
      });
      const awaitSigner = async (): Promise<OWSSigner> => {
        const loaded = wrapSignerWithCeremonyCopy(await signerPromise);
        signerRef.current = loaded;
        owsProvider.setSigner(loaded);
        return loaded;
      };
      awaitSignerRef.current = awaitSigner;
      const signer = createDeferredSigner(awaitSigner);

      const wallet = OWSWallet.prepare({ debug: true });
      walletRef.current = wallet;
      owsProvider.setWallet(wallet);

      const ask = <T,>(
        build: (handlers: {
          id: string;
          resolve: (value: T) => void;
          reject: (error: unknown) => void;
        }) => ActiveModal,
      ) => pushModal(build);

      registerConfigureRpc(wallet, chainRepository);

      registerAccountConnect(wallet, signer, {
        storage: walletStorage,
        ensureReady,
        requestConnectApproval: () =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "connect",
            resolve,
          })),
        getChainId: () => useWalletSessionStore.getState().chainId,
      });

      const catalog = chainRepository.getCatalog();
      const defaultChainId = DEFAULT_CHAIN_ID;
      const rpcHelper = new RpcHelper(
        new Map(catalog.map((chain) => [chain.chainId, chain.rpcUrl])),
        wallet,
        signer,
        {
          defaultChainId,
          onChainChanged,
          executionPermissions: {
            requestExecutionPermissions: async (requests) => {
              await ensureOnboardedForSigning();
              const wallet = await owsProvider.getWallet();
              const display = await wallet.requestDisplay();
              try {
                if (requests.length === 0) {
                  return [];
                }

                const prepared = requests.map((request) => {
                  const permissionType = request.permission.type;
                  const isErc20Periodic =
                    permissionType === ERC20_TOKEN_PERIODIC;
                  const isLiFiSwap = permissionType === LIFI_SWAP_PERIODIC;
                  const isLiFiApprove = permissionType === LIFI_SWAP_APPROVE;
                  if (!isErc20Periodic && !isLiFiSwap && !isLiFiApprove) {
                    throw new OwsInvalidParamsError(
                      `Unsupported execution permission type: ${permissionType}`,
                    );
                  }
                  const chain = resolveChain(request.chainId);
                  if (!chain?.useRelayer) {
                    throw new OwsInvalidParamsError(
                      `Chain ${request.chainId} does not support execution permissions`,
                    );
                  }
                  if (
                    (isLiFiSwap || isLiFiApprove) &&
                    liFiUtils.resolveSwapEnforcer(request.chainId) === null
                  ) {
                    throw new OwsInvalidParamsError(
                      `LiFi swap permissions are not supported on chain ${request.chainId}`,
                    );
                  }
                  const grantKind = isLiFiSwap
                    ? ("grantLiFiSwapPermission" as const)
                    : isLiFiApprove
                      ? ("grantLiFiApprovePermission" as const)
                      : ("grantExecutionPermission" as const);
                  return { request, chain, grantKind };
                });

                const domain = transactionUtils.resolveHostDomain();
                const { hostDomain } = await configProvider.getConfig();
                const batchCount = prepared.length;
                const approvedItems = [];

                for (let batchIndex = 0; batchIndex < prepared.length; batchIndex++) {
                  const { request, chain, grantKind } = prepared[batchIndex]!;
                  const started = performance.now();
                  const account = analyticsAccountAddress();
                  try {
                    const approved =
                      await ask<IGrantExecutionPermissionResult>(
                        ({ id, resolve, reject }) => ({
                          id,
                          kind: grantKind,
                          request: {
                            request,
                            domain,
                            chainName: chain.label,
                            batchIndex,
                            batchCount,
                          },
                          resolve,
                          reject,
                        }),
                      );
                    approvedItems.push({
                      request,
                      permission: approved.permission,
                      memo: approved.memo,
                    });
                  } catch (error: unknown) {
                    const durationMs = Math.round(performance.now() - started);
                    if (isAnalyticsCancelled(error)) {
                      eventBus.emitAnalytics(
                        new DelegationCreateCancelledEvent(
                          hostDomain,
                          account,
                          request.chainId,
                          durationMs,
                        ),
                      );
                    } else {
                      eventBus.emitAnalytics(
                        new DelegationCreateFailedEvent(
                          hostDomain,
                          account,
                          request.chainId,
                          analyticsErrorCode(error),
                          durationMs,
                        ),
                      );
                    }
                    throw error;
                  }
                }

                const signStarted = performance.now();
                const account = analyticsAccountAddress();
                try {
                  const storedList =
                    await delegationService.createExecutionPermissions({
                      items: approvedItems,
                      onDelegationsSigned: onSigningAuthenticated,
                    });
                  const durationMs = Math.round(performance.now() - signStarted);
                  for (const stored of storedList) {
                    eventBus.emitAnalytics(
                      new DelegationCreatedEvent(
                        hostDomain,
                        account,
                        stored.chainId,
                        durationMs,
                      ),
                    );
                  }
                  return storedList.map((stored) => stored.permissionResponse);
                } catch (error: unknown) {
                  const durationMs = Math.round(performance.now() - signStarted);
                  const chainId = approvedItems[0]!.request.chainId;
                  if (isAnalyticsCancelled(error)) {
                    eventBus.emitAnalytics(
                      new DelegationCreateCancelledEvent(
                        hostDomain,
                        account,
                        chainId,
                        durationMs,
                      ),
                    );
                  } else {
                    eventBus.emitAnalytics(
                      new DelegationCreateFailedEvent(
                        hostDomain,
                        account,
                        chainId,
                        analyticsErrorCode(error),
                        durationMs,
                      ),
                    );
                  }
                  throw error;
                }
              } finally {
                await display.hide();
              }
            },
            revokeExecutionPermission: async (params) => {
              await ensureOnboardedForSigning();
              const wallet = await owsProvider.getWallet();
              const display = await wallet.requestDisplay();
              try {
                const stored = await delegationService.findByPermissionContext(
                  params.permissionContext,
                );
                const chainId =
                  stored?.chainId ?? rpcHelper.getChainId();
                const chain = resolveChain(chainId);
                if (!chain?.useRelayer) {
                  throw new OwsInvalidParamsError(
                    `Chain ${chainId} does not support canceling permissions`,
                  );
                }
                const owner =
                  useWalletSessionStore.getState().evmAddress ||
                  loadCachedEvmAddress();
                if (!owner) {
                  throw new OwsInvalidParamsError(
                    "Wallet address is required to cancel a permission",
                  );
                }
                const domain =
                  stored?.hostDomain ??
                  transactionUtils.resolveHostDomain();
                const { hostDomain } = await configProvider.getConfig();
                const started = performance.now();
                const account = analyticsAccountAddress(owner);
                await runWithAnalytics(
                  (event) => eventBus.emitAnalytics(event),
                  async () => {
                    const txHash = await ask<EVMTransactionHash>(
                      ({ id, resolve, reject }) => ({
                        id,
                        kind: "cancelDelegation",
                        request: {
                          domain: String(domain),
                          chainName: chain.label,
                          chainId,
                          ownerAddress: owner,
                        },
                        execute: async (payment: IRelayerConfirmSendResult, ui) => {
                          const result = await delegationService.cancelDelegation({
                            chainId,
                            paymentToken: payment.paymentToken,
                            feeAtoms: payment.feeAtoms,
                            ...(stored ? { stored } : {}),
                            permissionContext: params.permissionContext,
                            ...ui,
                          });
                          return result.transactionHash;
                        },
                        resolve,
                        reject,
                      }),
                    );
                    return txHash;
                  },
                  {
                    success: (txHash) =>
                      new DelegationCancelledEvent(
                        hostDomain,
                        account,
                        chainId,
                        txHash,
                        Math.round(performance.now() - started),
                      ),
                    cancelled: () =>
                      new DelegationCancelAbortedEvent(
                        hostDomain,
                        account,
                        chainId,
                        Math.round(performance.now() - started),
                      ),
                    failed: (errorCode) =>
                      new DelegationCancelFailedEvent(
                        hostDomain,
                        account,
                        chainId,
                        errorCode,
                        Math.round(performance.now() - started),
                      ),
                  },
                );
                return null;
              } finally {
                await display.hide();
              }
            },
            getSupportedExecutionPermissions: () =>
              delegationService.getSupportedExecutionPermissions(),
            getGrantedExecutionPermissions: async () => {
              await ensureReady();
              return delegationService.getGrantedExecutionPermissions();
            },
          },
        },
      );
      rpcHelperRef.current = rpcHelper;
      owsProvider.setRpcHelper(rpcHelper);
      session.setChainId(rpcHelper.getChainId());
      chainEvents = rpcHelper.events;

      registerFocusModeRpc(wallet, rpcHelper);

      registerOnrampRpc(wallet, {
        getOwnerAddress: () => {
          const address = useWalletSessionStore.getState().evmAddress;
          if (!address || String(address).toLowerCase() === "0x0") {
            return null;
          }
          return address;
        },
      });

      registerBridgeRpc(wallet, {
        getOwnerAddress: () => {
          const address = useWalletSessionStore.getState().evmAddress;
          if (!address || String(address).toLowerCase() === "0x0") {
            return null;
          }
          return address;
        },
        getSessionChainId: () => useWalletSessionStore.getState().chainId,
        chainRepository,
        knownAssetRepository,
        cctpUtils,
      });

      registerAddAssetRpc(wallet, {
        knownAssetRepository,
        trackedAssetRepository,
        getOwnerAddress: () => useWalletSessionStore.getState().evmAddress,
        requestAddAssetApproval: (request) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "addAsset",
            request,
            resolve,
          })),
      });

      registerCreateAccountRpc(wallet, {
        createNewWallet,
        createNewWalletFromUi,
        createPasskeyRegistrationOnly,
      });

      registerApprovalSigning(wallet, signer, {
        ensureReady: ensureOnboardedForSigning,
        onAuthenticated: onSigningAuthenticated,
        chainRpc: rpcHelper,
        approveAndSignPersonalMessage: async (
          request: PersonalSignApprovalRequest,
        ) => {
          const { hostDomain } = await configProvider.getConfig();
          const started = performance.now();
          const account = analyticsAccountAddress(request.address);
          const siweFields = siweUtils.tryParsePersonalMessage(request.message);
          return runWithAnalytics(
            (event) => eventBus.emitAnalytics(event),
            () =>
              ask(({ id, resolve, reject }) =>
                siweFields
                  ? {
                      id,
                      kind: "siwe",
                      source: "personalSign",
                      request,
                      fields: siweFields,
                      resolve,
                      reject,
                    }
                  : {
                      id,
                      kind: "personalSign",
                      request,
                      resolve,
                      reject,
                    },
              ),
            {
              success: () =>
                new PersonalSignEvent(
                  hostDomain,
                  account,
                  request.message.length,
                  Math.round(performance.now() - started),
                ),
              cancelled: () =>
                new PersonalSignCancelledEvent(
                  hostDomain,
                  account,
                  Math.round(performance.now() - started),
                ),
              failed: (errorCode) =>
                new PersonalSignFailedEvent(
                  hostDomain,
                  account,
                  errorCode,
                  Math.round(performance.now() - started),
                ),
            },
          );
        },
        approveAndSignTypedData: async (
          request: SignTypedDataApprovalRequest,
        ) => {
          const { hostDomain } = await configProvider.getConfig();
          const started = performance.now();
          const account = analyticsAccountAddress(request.address);
          const siweFields = siweUtils.tryParseTypedData(request.typedData);
          return runWithAnalytics(
            (event) => eventBus.emitAnalytics(event),
            () =>
              ask(({ id, resolve, reject }) =>
                siweFields
                  ? {
                      id,
                      kind: "siwe",
                      source: "typedData",
                      request,
                      fields: siweFields,
                      resolve,
                      reject,
                    }
                  : {
                      id,
                      kind: "typedData",
                      request,
                      resolve,
                      reject,
                    },
              ),
            {
              success: () =>
                new TypedSignEvent(
                  hostDomain,
                  account,
                  request.typedData.primaryType,
                  Math.round(performance.now() - started),
                ),
              cancelled: () =>
                new TypedSignCancelledEvent(
                  hostDomain,
                  account,
                  Math.round(performance.now() - started),
                ),
              failed: (errorCode) =>
                new TypedSignFailedEvent(
                  hostDomain,
                  account,
                  errorCode,
                  Math.round(performance.now() - started),
                ),
            },
          );
        },
        approveAndSignTransaction: async (
          request: SendTransactionApprovalRequest,
        ) => {
          const { hostDomain } = await configProvider.getConfig();
          const started = performance.now();
          const account = analyticsAccountAddress(request.address);
          const methodId = analyticsMethodId(request.data);
          const to = request.to;

          return runWithAnalytics(
            (event) => eventBus.emitAnalytics(event),
            async () => {
              if (!request.to) {
                throw new OwsUserRejectedError(
                  "Contract creation is not supported yet",
                );
              }

              await ensureOnboardedForSigning();

              const chain = resolveChain(request.chainId);
              const useRelayer = chain?.useRelayer === true;

              const transfer = transactionUtils.tryDecodeErc20Transfer(
                request.to,
                request.data,
              );

              const executeSend = async (
                payment: {
                  paymentToken?: EVMAccountAddress;
                  feeAtoms?: TokenAmount;
                },
                ui?: import("../lib/types/domain/RelayerSendUi").IRelayerSendUiCallbacks,
              ) => {
                let relayerOptions:
                  | {
                      paymentToken: EVMAccountAddress;
                      feeAtoms: TokenAmount;
                    }
                  | undefined;
                if (useRelayer) {
                  const confirmed = requireRelayerConfirmPayment(payment);
                  relayerOptions = {
                    paymentToken: confirmed.paymentToken,
                    feeAtoms: confirmed.feeAtoms,
                  };
                }

                const valueRaw = String(request.value);
                const value =
                  valueRaw && valueRaw !== "0x0" && valueRaw !== "0x"
                    ? BigInt(valueRaw)
                    : undefined;

                const result = await transactionService.sendTransaction(
                  request.chainId,
                  {
                    to: request.to!,
                    data: request.data,
                    value,
                  },
                  useRelayer && relayerOptions
                    ? { ...relayerOptions, ...ui }
                    : undefined,
                );
                return result.transactionHash;
              };

              let hash: EVMTransactionHash;
              if (transfer) {
                const known = await knownAssetRepository.getKnownAsset(
                  request.chainId,
                  transfer.tokenAddress,
                );
                const owner = useWalletSessionStore.getState().evmAddress;
                const tracked = (await trackedAssetRepository.list(owner)).find(
                  (asset) =>
                    asset.chainId === request.chainId &&
                    asset.address === transfer.tokenAddress,
                );
                const tokenName =
                  tracked?.name ?? known?.name ?? transfer.tokenAddress;
                const tokenSymbol = tracked?.symbol ?? known?.symbol ?? "TOKEN";
                const decimals = tracked?.decimals ?? known?.decimals ?? null;
                hash = await ask<EVMTransactionHash>(
                  ({ id, resolve, reject }) => ({
                    id,
                    kind: "confirmTransfer",
                    request: {
                      domain: transactionUtils.resolveHostDomain(),
                      amount: transactionUtils.formatTokenAmount(
                        transfer.amount,
                        decimals,
                      ),
                      tokenName,
                      tokenSymbol,
                      tokenAddress: transfer.tokenAddress,
                      receiver: transfer.recipient,
                      chainName: transactionUtils.chainLabelFor(
                        request.chainId,
                        chainRepository.getCatalog(),
                      ),
                      chainId: request.chainId,
                      ownerAddress: request.address,
                      useRelayer,
                    },
                    execute: executeSend,
                    resolve,
                    reject,
                  }),
                );
              } else {
                hash = await ask<EVMTransactionHash>(
                  ({ id, resolve, reject }) => ({
                    id,
                    kind: "sendTransaction",
                    request: {
                      ...request,
                      useRelayer,
                    },
                    execute: executeSend,
                    resolve,
                    reject,
                  }),
                );
              }

              await onSigningAuthenticated();
              return hash;
            },
            {
              success: (txHash) =>
                new TransactionSubmittedEvent(
                  hostDomain,
                  account,
                  request.chainId,
                  to!,
                  txHash,
                  Math.round(performance.now() - started),
                  methodId,
                ),
              cancelled: () =>
                new TransactionSubmitCancelledEvent(
                  hostDomain,
                  account,
                  request.chainId,
                  Math.round(performance.now() - started),
                  to,
                ),
              failed: (errorCode) =>
                new TransactionSubmitFailedEvent(
                  hostDomain,
                  account,
                  request.chainId,
                  errorCode,
                  Math.round(performance.now() - started),
                  to,
                ),
            },
          );
        },
      });

      registerCredentialsProvider(wallet, signer, {
        repository: credentialRepository,
        oid4vci,
        oid4vp,
        trust: issuerTrust,
        attestationProvider,
        ensureReady,
        ensureOnboarded: ensureOnboardedForSigning,
        onAuthenticated: onSigningAuthenticated,
        emitAnalytics: (event) => eventBus.emitAnalytics(event),
        configProvider,
        requestCredentialOfferApproval: (
          request: CredentialOfferApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "credentialOffer",
            request,
            resolve,
          })),
        requestCredentialPresentationApproval: (
          request: CredentialPresentationApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "credentialPresentation",
            request,
            resolve,
          })),
      });

      void wallet.start().catch((error: unknown) => {
        if (cancelled) return;
        console.error("[oneshot-wallet] Postmate handshake failed", error);
        useWalletSessionStore
          .getState()
          .setBootError(error instanceof Error ? error.message : String(error));
      });

      void awaitSigner()
        .then(() => {
          if (cancelled) return;
          useWalletSessionStore.getState().setSignerReady(true);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("[oneshot-wallet] Signing Layer failed to load", error);
          useWalletSessionStore
            .getState()
            .setBootError(error instanceof Error ? error.message : String(error));
        });

      const listed = await credentialRepository.list();
      if (cancelled) return;
      useWalletSessionStore.getState().setCredentialCount(listed.length);
      const owner = useWalletSessionStore.getState().evmAddress;
      const tracked = await trackedAssetRepository.list(owner);
      if (cancelled) return;
      useWalletSessionStore.getState().setTrackedAssetCount(tracked.length);
      useWalletSessionStore.getState().setReady(true);
      console.info("[oneshot-wallet] ready", {
        chainId: rpcHelper.getChainId(),
      });
    }

    void boot().catch((error: unknown) => {
      console.error("[oneshot-wallet] failed to start", error);
      useWalletSessionStore
        .getState()
        .setBootError(error instanceof Error ? error.message : String(error));
    });

    return () => {
      cancelled = true;
      chainEvents?.off("chainChanged", onChainChanged);
    };
    // Boot once; handlers close over ensureReady via ensureReadyRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only boot
  }, []);
}
