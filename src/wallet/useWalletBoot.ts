import { useEffect, type RefObject } from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type EVMAccountAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";
import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { InMemoryIssuerTrustRegistry } from "../demo/in-memory-trust-registry";
import type { CachedRelayerCredentialRepository } from "../credentials/CachedRelayerCredentialRepository";
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
import { registerSetStyleRpc } from "../style/registerSetStyle";
import { wrapSignerWithPasskeyPrompts } from "./wrapSignerWithPasskeyPrompts";
import { DEFAULT_CHAIN_ID } from "../lib/implementations/data/HardcodedChainRepository";
import type {
  IChainRepository,
  IKnownAssetRepository,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type { ITransactionService } from "../lib/interfaces/business";
import type {
  IConfigProvider,
  IOWSProvider,
  ITransactionUtils,
} from "../lib/interfaces/utils";
import type { SupportedChain } from "../lib/types/domain";
import { registerAddAssetRpc } from "./registerAddAsset";
import { registerFocusModeRpc } from "./registerFocusMode";
import { loadCredentialId } from "../storage";
import { pushModal } from "./pushModal";
import type { ActiveModal, IRelayerConfirmSendResult } from "./modalTypes";
import { useWalletSessionStore } from "./sessionStore";
import { DEMO_HOLDER_PRIVATE_JWK } from "../demo/demo-keys";

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
  feeAtoms?: bigint;
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
  resolveChain: (chainId: EVMChainId) => SupportedChain | null;
  configProvider: IConfigProvider;
  owsProvider: IOWSProvider;
  chainRepository: IChainRepository;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  transactionService: ITransactionService;
  transactionUtils: ITransactionUtils;
  credentialRepository: CachedRelayerCredentialRepository;
  walletStorage: AccountConnectStorage;
}

export function useWalletBoot({
  signerContainerRef,
  walletRef,
  signerRef,
  rpcHelperRef,
  awaitSignerRef,
  ensureReadyRef,
  ensureReady,
  ensureOnboardedForSigning,
  onSigningAuthenticated,
  resolveChain,
  configProvider,
  owsProvider,
  chainRepository,
  knownAssetRepository,
  trackedAssetRepository,
  transactionService,
  transactionUtils,
  credentialRepository,
  walletStorage,
}: IUseWalletBootParams): void {
  useEffect(() => {
    let cancelled = false;
    let chainEvents: RpcHelper["events"] | undefined;
    const onChainChanged = (next: EVMChainId) => {
      useWalletSessionStore.getState().setChainId(next);
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
        const loaded = wrapSignerWithPasskeyPrompts(await signerPromise);
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

      const walletConfig = await configProvider.getConfig();

      registerSetStyleRpc(wallet, chainRepository);

      registerAccountConnect(wallet, signer, {
        storage: walletStorage,
        ensureReady,
        requestConnectApproval: () =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "connect",
            resolve,
          })),
        displaySize: walletConfig.displayCompactSize,
      });

      const catalog = chainRepository.getCatalog();
      const defaultChainId = DEFAULT_CHAIN_ID;
      const rpcHelper = new RpcHelper(
        new Map(catalog.map((chain) => [chain.chainId, chain.rpcUrl])),
        wallet,
        signer,
        { defaultChainId, onChainChanged },
      );
      rpcHelperRef.current = rpcHelper;
      owsProvider.setRpcHelper(rpcHelper);
      session.setChainId(rpcHelper.getChainId());
      chainEvents = rpcHelper.events;

      registerFocusModeRpc(wallet, rpcHelper);

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
        displaySize: walletConfig.displayCompactSize,
      });

      registerApprovalSigning(wallet, signer, {
        ensureReady: ensureOnboardedForSigning,
        onAuthenticated: onSigningAuthenticated,
        chainRpc: rpcHelper,
        requestPersonalSignApproval: (request: PersonalSignApprovalRequest) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "personalSign",
            request,
            resolve,
          })),
        requestSignTypedDataApproval: (
          request: SignTypedDataApprovalRequest,
        ) =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "typedData",
            request,
            resolve,
          })),
        approveAndSignTransaction: async (
          request: SendTransactionApprovalRequest,
        ) => {
          if (!request.to) {
            throw new OwsUserRejectedError(
              "Contract creation is not supported yet",
            );
          }

          await ensureReadyRef.current();

          const chain = resolveChain(request.chainId);
          const useRelayer = chain?.useRelayer === true;

          const transfer = transactionUtils.tryDecodeErc20Transfer(
            request.to,
            request.data,
          );

          type ConfirmResult =
            | false
            | {
                paymentToken?: EVMAccountAddress;
                feeAtoms?: bigint;
              };

          const prefetch = useRelayer
            ? await transactionService.prefetchForRelayerSend(
                request.chainId,
                request.address,
              )
            : undefined;

          let confirmed: ConfirmResult;
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
            confirmed = await ask<ConfirmResult>(({ id, resolve }) => ({
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
                receiver: transfer.recipient,
                chainName: transactionUtils.chainLabelFor(
                  request.chainId,
                  chainRepository.getCatalog(),
                ),
                chainId: request.chainId,
                ownerAddress: request.address,
                useRelayer,
              },
              resolve,
            }));
          } else {
            confirmed = await ask<ConfirmResult>(({ id, resolve }) => ({
              id,
              kind: "sendTransaction",
              request: {
                ...request,
                useRelayer,
              },
              resolve,
            }));
          }

          if (!confirmed) {
            throw new OwsUserRejectedError(
              "User rejected the transaction request",
            );
          }

          let relayerOptions:
            | {
                paymentToken: EVMAccountAddress;
                feeAtoms: bigint;
                prefetch: typeof prefetch;
              }
            | undefined;
          if (useRelayer) {
            const payment = requireRelayerConfirmPayment(confirmed);
            relayerOptions = {
              paymentToken: payment.paymentToken,
              feeAtoms: payment.feeAtoms,
              prefetch,
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
              to: request.to,
              data: request.data,
              value,
            },
            relayerOptions,
          );
          await onSigningAuthenticated();
          return result.transactionHash;
        },
      });

      registerCredentialsProvider(wallet, signer, {
        repository: credentialRepository,
        oid4vci,
        oid4vp,
        trust: issuerTrust,
        attestationProvider,
        ensureReady,
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

      void awaitSigner().catch((error: unknown) => {
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
