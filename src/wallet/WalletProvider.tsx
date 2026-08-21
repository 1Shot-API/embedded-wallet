import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import {
  AddressUtils,
  OWSWallet,
  RpcHelper,
  type IBlockchainProvider,
} from "@1shotapi/ows-wallet-utils";
import {
  EVMAccountAddress,
  HexString,
  SolanaAccountAddress,
  type CredentialId,
  type CredentialSummary,
  type EVMChainId,
  type EVMTransactionHash,
  type StoredCredential,
} from "@1shotapi/ows-types";
import { CachedRelayerVaultRepository } from "../lib/implementations/data/CachedRelayerVaultRepository";
import type { AccountConnectStorage } from "../ows/registerAccountConnect";
import { RelayerCredentialsClient } from "../lib/implementations/data/utils/RelayerCredentialsClient";
import { HardcodedChainRepository } from "../lib/implementations/data/HardcodedChainRepository";
import { HardcodedKnownAssetRepository } from "../lib/implementations/data/HardcodedKnownAssetRepository";
import { LocalStorageTrackedAssetRepository } from "../lib/implementations/data/LocalStorageTrackedAssetRepository";
import { BlockscoutAssetActivityRepository } from "../lib/implementations/data/BlockscoutAssetActivityRepository";
import { OneshotRelayerRepository } from "../lib/implementations/data/OneshotRelayerRepository";
import {
  BusinessTransactionUtils,
  DelegationService,
  TransactionService,
} from "../lib/implementations/business";
import {
  ConfigProvider,
  OWSProvider,
  SupportedChainsBlockchainProvider,
  EventBus,
  TransactionUtils,
  AnalyticsBridge,
  runWithAnalytics,
} from "../lib/implementations/utils";
import {
  TransactionSubmitCancelledEvent,
  TransactionSubmittedEvent,
  TransactionSubmitFailedEvent,
} from "../lib/types/events/productEvents";
import type {
  IAssetActivityRepository,
  IChainRepository,
  IKnownAssetRepository,
  IOneshotRelayerRepository,
  IRecordSentActivityParams,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type {
  IDelegationService,
  ITransactionService,
} from "../lib/interfaces/business";
import type {
  IConfigProvider,
  IEventBus,
  IOWSProvider,
  ITransactionUtils,
} from "../lib/interfaces/utils";
import type {
  AssetActivity,
  KnownAsset,
  SupportedChain,
  TrackedAsset,
} from "../lib/types/domain";
import type {
  IDelegationSummary,
  IStoredDelegation,
} from "../lib/types/domain/StoredDelegation";
import type { DelegationId } from "../lib/types/primitives/DelegationId";
import type { TrackedAssetId } from "../lib/types/primitives";
import {
  loadCachedEvmAddress,
  loadAccountsPermissionGranted,
  saveAccountsPermissionGranted,
  saveCachedAddresses,
  clearWalletStorage,
} from "../storage";
import type { IRelayerConfirmSendResult } from "./modalTypes";
import { pushModal } from "./pushModal";
import { useWalletAuth } from "./useWalletAuth";
import { useWalletAssets } from "./useWalletAssets";
import { useWalletBoot } from "./useWalletBoot";
import { useWalletSessionStore } from "./sessionStore";
/** Filled once the Signing Layer iframe finishes loading / wallet handshake. */
const configProvider: IConfigProvider = new ConfigProvider();
const owsProvider: IOWSProvider = new OWSProvider();
const chainRepository: IChainRepository = new HardcodedChainRepository();
const blockchainProvider: IBlockchainProvider =
  new SupportedChainsBlockchainProvider(chainRepository);
const addressUtils = new AddressUtils(blockchainProvider);
const eventBus: IEventBus = new EventBus();
const analyticsBridge = new AnalyticsBridge({
  eventBus,
  owsProvider,
  configProvider,
});
analyticsBridge.start();
const transactionUtils: ITransactionUtils = new TransactionUtils();
const knownAssetRepository: IKnownAssetRepository =
  new HardcodedKnownAssetRepository(blockchainProvider);
const trackedAssetRepository: ITrackedAssetRepository =
  new LocalStorageTrackedAssetRepository(
    blockchainProvider,
    eventBus,
    configProvider,
  );
const assetActivityRepository: IAssetActivityRepository =
  new BlockscoutAssetActivityRepository(eventBus, configProvider);
const oneshotRelayerRepository: IOneshotRelayerRepository =
  new OneshotRelayerRepository({
    blockchain: blockchainProvider,
    owsProvider,
  });

const businessTransactionUtils = new BusinessTransactionUtils({
  chainRepository,
  relayerRepository: oneshotRelayerRepository,
  blockchain: blockchainProvider,
  presentationTransactionUtils: transactionUtils,
  owsProvider,
});

const transactionService: ITransactionService = new TransactionService({
  chainRepository,
  relayerRepository: oneshotRelayerRepository,
  transactionUtils: businessTransactionUtils,
});

const relayerCredentialsClient = new RelayerCredentialsClient({
  configProvider,
  owsProvider,
});

const credentialRepository = new CachedRelayerVaultRepository({
  client: relayerCredentialsClient,
  configProvider,
  owsProvider,
});

const delegationService: IDelegationService = new DelegationService({
  chainRepository,
  delegationRepository: credentialRepository,
  blockchain: blockchainProvider,
  transactionUtils: businessTransactionUtils,
  presentationTransactionUtils: transactionUtils,
  owsProvider,
});

const walletStorage: AccountConnectStorage = {
  loadCachedEvmAddress,
  saveCachedAddresses: (evm, solana) => {
    saveCachedAddresses(evm, solana);
    const session = useWalletSessionStore.getState();
    if (solana) {
      session.setAddresses(evm, solana);
    } else {
      session.setAddresses(evm, session.solanaAddress);
    }
  },
  loadAccountsPermissionGranted,
  saveAccountsPermissionGranted,
};

/** Imperative wallet APIs that need refs / boot (not UI session state). */
export type WalletContextValue = {
  /** Startup singletons — prefer these over constructing repos/utils in components. */
  chainRepository: IChainRepository;
  blockchainProvider: IBlockchainProvider;
  addressUtils: AddressUtils;
  configProvider: IConfigProvider;
  transactionUtils: ITransactionUtils;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  assetActivityRepository: IAssetActivityRepository;
  oneshotRelayerRepository: IOneshotRelayerRepository;
  transactionService: ITransactionService;
  delegationService: IDelegationService;
  eventBus: IEventBus;

  chains: SupportedChain[];
  resolveChain: (chainId: EVMChainId) => SupportedChain | null;
  signerContainerRef: RefObject<HTMLDivElement | null>;
  getSigner: () => OWSSigner | null;
  /** Resolves when the Signing Layer iframe has finished loading. */
  awaitSignerReady: () => Promise<OWSSigner>;
  /** Awaits Signing Layer load, then unlocks / runs setup if needed. */
  ensureReady: () => Promise<void>;
  setUnlocked: (value: boolean) => void;
  refreshAddresses: () => Promise<void>;
  refreshCredentialCount: () => Promise<void>;
  switchChain: (chainId: string) => Promise<void>;
  requestHide: () => Promise<void>;
  listCredentials: () => Promise<CredentialSummary[]>;
  getCredential: (
    credentialId: CredentialId,
  ) => Promise<StoredCredential | undefined>;
  refreshCredentialsFromRelayer: () => Promise<void>;
  listDelegations: () => Promise<IDelegationSummary[]>;
  getDelegation: (
    delegationId: DelegationId,
  ) => Promise<IStoredDelegation | undefined>;
  refreshDelegationsFromRelayer: () => Promise<void>;
  /**
   * In-wallet cancel from the Delegations tab. Opens the same confirm modal as
   * `wallet_revokeExecutionPermission`, then deletes the vault row on success.
   */
  cancelStoredDelegation: (
    delegationId: DelegationId,
  ) => Promise<{
    chainId: EVMChainId;
    transactionHash: EVMTransactionHash;
  }>;
  listTrackedAssets: () => Promise<TrackedAsset[]>;
  addTrackedAsset: (
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ) => Promise<TrackedAsset>;
  removeTrackedAsset: (
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ) => Promise<void>;
  getKnownAsset: (
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ) => Promise<KnownAsset | null>;
  resolveTrackedAsset: (
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ) => Promise<TrackedAsset>;
  requestBalanceRefresh: (id?: TrackedAssetId) => Promise<void>;
  listAssetActivity: (
    owner: EVMAccountAddress,
    asset: TrackedAsset,
    limit?: number,
  ) => Promise<AssetActivity[]>;
  recordSentActivity: (
    params: IRecordSentActivityParams,
  ) => Promise<AssetActivity>;
  /**
   * In-wallet submit (TransferTokensModal). Does not show host consent —
   * callers already collected amount/recipient. Branches via TransactionService
   * (`useRelayer` → 7710, else raw RPC).
   */
  sendTransaction: (
    chainId: EVMChainId,
    to: EVMAccountAddress,
    data: HexString,
    value?: bigint,
    payment?: {
      paymentToken: EVMAccountAddress;
      feeAtoms: bigint;
    },
  ) => Promise<EVMTransactionHash>;
  openExportPrivateKey: () => Promise<void>;
  openImportPrivateKey: () => Promise<boolean>;
  openAdvancedOptions: (options?: { allowExport?: boolean }) => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  createNewWalletFromUi: () => Promise<void>;
};

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);
  if (!value) {
    throw new Error("useWallet must be used within WalletProvider");
  }
  return value;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const signerContainerRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<OWSWallet | null>(null);
  const signerRef = useRef<OWSSigner | null>(null);
  const rpcHelperRef = useRef<RpcHelper | null>(null);
  const awaitSignerRef = useRef<(() => Promise<OWSSigner>) | null>(null);

  const [chains, setChains] = useState<SupportedChain[]>(() =>
    [...chainRepository.getCatalog()].filter((c) => c.enabled),
  );

  const resolveChain = useCallback((chainId: EVMChainId): SupportedChain | null => {
    const key = String(chainId).toLowerCase();
    return (
      chainRepository
        .getCatalog()
        .find((chain) => String(chain.chainId).toLowerCase() === key) ?? null
    );
  }, []);

  const refreshAllowedChains = useCallback(async () => {
    const listed = await chainRepository.list();
    setChains(listed);
    const session = useWalletSessionStore.getState();
    const stillAllowed = listed.some(
      (chain) =>
        String(chain.chainId).toLowerCase() ===
        String(session.chainId).toLowerCase(),
    );
    if (!stillAllowed && listed[0]) {
      const next = listed[0];
      session.setChainId(next.chainId);
      const rpc = rpcHelperRef.current;
      if (rpc) {
        try {
          await rpc.switchChain(next.chainId);
        } catch (error: unknown) {
          console.warn("[oneshot-wallet] failed to switch after allowlist", error);
        }
      }
    }
  }, []);

  useEffect(() => {
    return chainRepository.onAllowedChainsChanged(() => {
      void refreshAllowedChains();
    });
  }, [refreshAllowedChains]);

  const {
    setUnlocked,
    refreshAddresses,
    refreshCredentialCount,
    loginWithPasskey,
    createNewWallet,
    createNewWalletFromUi,
    createPasskeyRegistrationOnly,
    ensureReady,
    ensureReadyRef,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    awaitSignerReady,
  } = useWalletAuth({
    signerRef,
    walletRef,
    awaitSignerRef,
    credentialRepository,
    relayerCredentialsClient,
    eventBus,
    configProvider,
  });

  // Keep create callbacks current for mount-only wallet boot closures.
  const createNewWalletRef = useRef(createNewWallet);
  const createNewWalletFromUiRef = useRef(createNewWalletFromUi);
  const createPasskeyRegistrationOnlyRef = useRef(
    createPasskeyRegistrationOnly,
  );
  useEffect(() => {
    createNewWalletRef.current = createNewWallet;
    createNewWalletFromUiRef.current = createNewWalletFromUi;
    createPasskeyRegistrationOnlyRef.current = createPasskeyRegistrationOnly;
  }, [
    createNewWallet,
    createNewWalletFromUi,
    createPasskeyRegistrationOnly,
  ]);

  const {
    listCredentials,
    getCredential,
    refreshCredentialsFromRelayer,
    listDelegations,
    getDelegation,
    refreshDelegationsFromRelayer,
    listTrackedAssets,
    addTrackedAsset,
    removeTrackedAsset,
    getKnownAsset,
    resolveTrackedAsset,
    requestBalanceRefresh,
    listAssetActivity,
    recordSentActivity,
  } = useWalletAssets({
    credentialRepository,
    knownAssetRepository,
    trackedAssetRepository,
    assetActivityRepository,
    eventBus,
    awaitSignerReady,
    refreshCredentialCount,
  });

  useWalletBoot({
    signerContainerRef,
    walletRef,
    signerRef,
    rpcHelperRef,
    awaitSignerRef,
    ensureReadyRef,
    ensureReady,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    createNewWallet: (accountName) => createNewWalletRef.current(accountName),
    createNewWalletFromUi: () => createNewWalletFromUiRef.current(),
    createPasskeyRegistrationOnly: (accountName) =>
      createPasskeyRegistrationOnlyRef.current(accountName),
    resolveChain,
    owsProvider,
    chainRepository,
    knownAssetRepository,
    trackedAssetRepository,
    transactionService,
    delegationService,
    transactionUtils,
    credentialRepository,
    walletStorage,
    eventBus,
    configProvider,
  });

  const switchChain = useCallback(async (next: string) => {
    const rpc = rpcHelperRef.current;
    if (!rpc) return;
    const previous = rpc.getChainId();
    try {
      await rpc.switchChain(next);
    } catch (error: unknown) {
      useWalletSessionStore.getState().setChainId(previous);
      console.error("[oneshot-wallet] chain switch failed", error);
      throw error;
    }
  }, []);

  const requestHide = useCallback(async () => {
    await walletRef.current?.requestHide();
  }, []);

  const sendTransaction = useCallback(
    async (
      chainId: EVMChainId,
      to: EVMAccountAddress,
      data: HexString,
      value?: bigint,
      payment?: {
        paymentToken: EVMAccountAddress;
        feeAtoms: bigint;
      },
    ) => {
      const { hostDomain } = await configProvider.getConfig();
      const started = performance.now();
      const methodId = data.length >= 10 ? data.slice(0, 10) : null;
      const accountAddress = (): EVMAccountAddress =>
        useWalletSessionStore.getState().evmAddress ||
        loadCachedEvmAddress() ||
        EVMAccountAddress("0x0");

      return runWithAnalytics(
        (event) => eventBus.emitAnalytics(event),
        async () => {
          await ensureOnboardedForSigning();
          const result = await transactionService.sendTransaction(
            chainId,
            { to, data, value },
            payment,
          );
          await onSigningAuthenticated();
          return result.transactionHash;
        },
        {
          success: (txHash) =>
            new TransactionSubmittedEvent(
              hostDomain,
              accountAddress(),
              chainId,
              to,
              txHash,
              Math.round(performance.now() - started),
              methodId,
            ),
          cancelled: () =>
            new TransactionSubmitCancelledEvent(
              hostDomain,
              accountAddress(),
              chainId,
              Math.round(performance.now() - started),
              to,
            ),
          failed: (errorCode) =>
            new TransactionSubmitFailedEvent(
              hostDomain,
              accountAddress(),
              chainId,
              errorCode,
              Math.round(performance.now() - started),
              to,
            ),
        },
      );
    },
    [ensureOnboardedForSigning, onSigningAuthenticated],
  );

  const cancelStoredDelegation = useCallback(
    async (delegationId: DelegationId) => {
      await ensureOnboardedForSigning();
      const stored = await credentialRepository.getDelegation(delegationId);
      if (!stored) {
        throw new Error("Permission not found in local cache.");
      }
      const chain = resolveChain(stored.chainId);
      if (!chain?.useRelayer) {
        throw new Error(
          `Chain ${stored.chainId} does not support canceling permissions`,
        );
      }
      const owner =
        useWalletSessionStore.getState().evmAddress ||
        loadCachedEvmAddress();
      if (!owner) {
        throw new Error("Wallet address is required to cancel a permission");
      }
      const transactionHash = await pushModal<EVMTransactionHash>(
        ({ id, resolve, reject }) => ({
          id,
          kind: "cancelDelegation",
          request: {
            domain: String(stored.hostDomain),
            chainName: chain.label,
            chainId: stored.chainId,
            ownerAddress: owner,
          },
          execute: async (payment: IRelayerConfirmSendResult) => {
            const result = await delegationService.cancelDelegation({
              chainId: stored.chainId,
              paymentToken: payment.paymentToken,
              feeAtoms: payment.feeAtoms,
              stored,
            });
            return result.transactionHash;
          },
          resolve,
          reject,
        }),
      );
      await onSigningAuthenticated();
      return { chainId: stored.chainId, transactionHash };
    },
    [
      ensureOnboardedForSigning,
      onSigningAuthenticated,
      resolveChain,
    ],
  );

  const openExportPrivateKey = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay();
    try {
      await pushModal<void>(({ id, resolve, reject }) => ({
        id,
        kind: "exportPrivateKey",
        resolve,
        reject,
      }));
    } finally {
      await display.hide();
    }
  }, []);

  const openImportPrivateKey = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return false;
    const display = await wallet.requestDisplay();
    try {
      const imported = await pushModal<boolean>(({ id, resolve, reject }) => ({
        id,
        kind: "importPrivateKey",
        resolve,
        reject,
      }));
      if (imported) {
        setUnlocked(true);
        useWalletSessionStore.getState().setWalletCreated(true);
        await refreshAddresses();
      }
      return imported;
    } finally {
      await display.hide();
    }
  }, [refreshAddresses, setUnlocked]);

  const openAdvancedOptions = useCallback(
    async (options?: { allowExport?: boolean }) => {
      const wallet = walletRef.current;
      if (!wallet) return;
      const allowExport = options?.allowExport !== false;
      const display = await wallet.requestDisplay();
      let choice: import("./modalTypes").AdvancedOptionsChoice = "close";
      try {
        choice = await pushModal<
          import("./modalTypes").AdvancedOptionsChoice
        >(({ id, resolve }) => ({
          id,
          kind: "advancedOptions",
          allowExport,
          resolve,
        }));
      } finally {
        await display.hide();
      }
      if (choice === "export") {
        await openExportPrivateKey();
      } else if (choice === "import") {
        await openImportPrivateKey();
      } else if (choice === "changeAccount") {
        clearWalletStorage();
        signerRef.current?.clearSession();
        const session = useWalletSessionStore.getState();
        session.setUnlocked(false);
        session.setWalletCreated(false);
        session.setAddresses(
          EVMAccountAddress("0x0"),
          SolanaAccountAddress("—"),
        );
        session.setCredentialCount(0);
        session.setTrackedAssetCount(0);
        session.unfocusWallet();
        walletRef.current?.providerEvents.emit("accountsChanged", []);
        // Land on OnboardingPanel (login / create). Do not call ensureReady —
        // that would immediately reopen the setup modal.
      }
    },
    [openExportPrivateKey, openImportPrivateKey],
  );

  const getSigner = useCallback(() => signerRef.current, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      chainRepository,
      blockchainProvider,
      addressUtils,
      configProvider,
      transactionUtils,
      knownAssetRepository,
      trackedAssetRepository,
      assetActivityRepository,
      oneshotRelayerRepository,
      transactionService,
      delegationService,
      eventBus,
      chains,
      resolveChain,
      signerContainerRef,
      getSigner,
      awaitSignerReady,
      ensureReady,
      setUnlocked,
      refreshAddresses,
      refreshCredentialCount,
      switchChain,
      requestHide,
      listCredentials,
      getCredential,
      refreshCredentialsFromRelayer,
      listDelegations,
      getDelegation,
      refreshDelegationsFromRelayer,
      cancelStoredDelegation,
      listTrackedAssets,
      addTrackedAsset,
      removeTrackedAsset,
      getKnownAsset,
      resolveTrackedAsset,
      requestBalanceRefresh,
      listAssetActivity,
      recordSentActivity,
      sendTransaction,
      openExportPrivateKey,
      openImportPrivateKey,
      openAdvancedOptions,
      loginWithPasskey,
      createNewWalletFromUi,
    }),
    [
      chains,
      resolveChain,
      getSigner,
      awaitSignerReady,
      ensureReady,
      setUnlocked,
      refreshAddresses,
      refreshCredentialCount,
      switchChain,
      requestHide,
      listCredentials,
      getCredential,
      refreshCredentialsFromRelayer,
      listDelegations,
      getDelegation,
      refreshDelegationsFromRelayer,
      cancelStoredDelegation,
      listTrackedAssets,
      addTrackedAsset,
      removeTrackedAsset,
      getKnownAsset,
      resolveTrackedAsset,
      requestBalanceRefresh,
      listAssetActivity,
      recordSentActivity,
      sendTransaction,
      openExportPrivateKey,
      openImportPrivateKey,
      openAdvancedOptions,
      loginWithPasskey,
      createNewWalletFromUi,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
