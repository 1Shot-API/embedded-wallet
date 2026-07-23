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
  HexString,
  type CredentialId,
  type CredentialSummary,
  type EVMAccountAddress,
  type EVMChainId,
  type EVMTransactionHash,
  type StoredCredential,
} from "@1shotapi/ows-types";
import { CachedRelayerCredentialRepository } from "../credentials/CachedRelayerCredentialRepository";
import type { AccountConnectStorage } from "../ows/registerAccountConnect";
import { RelayerCredentialsClient } from "../relayer/RelayerCredentialsClient";
import { withPasskeyPrompt } from "./withPasskeyPrompt";
import { HardcodedChainRepository } from "../lib/implementations/data/HardcodedChainRepository";
import { HardcodedKnownAssetRepository } from "../lib/implementations/data/HardcodedKnownAssetRepository";
import { LocalStorageTrackedAssetRepository } from "../lib/implementations/data/LocalStorageTrackedAssetRepository";
import { BlockscoutAssetActivityRepository } from "../lib/implementations/data/BlockscoutAssetActivityRepository";
import { OneshotRelayerRepository } from "../lib/implementations/data/OneshotRelayerRepository";
import { TransactionService } from "../lib/implementations/business";
import {
  ConfigProvider,
  OWSProvider,
  SupportedChainsBlockchainProvider,
  EventBus,
  TransactionUtils,
} from "../lib/implementations/utils";
import type {
  IAssetActivityRepository,
  IChainRepository,
  IKnownAssetRepository,
  IOneshotRelayerRepository,
  IRecordSentActivityParams,
  ITrackedAssetRepository,
} from "../lib/interfaces/data";
import type { ITransactionService } from "../lib/interfaces/business";
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
import type { TrackedAssetId } from "../lib/types/primitives";
import {
  loadBackup,
  loadCachedEvmAddress,
  saveBackup,
  saveCachedAddresses,
} from "../storage";
import { pushModal } from "./pushModal";
import { useWalletAuth } from "./useWalletAuth";
import { useWalletAssets } from "./useWalletAssets";
import { useWalletBoot } from "./useWalletBoot";
import { useWalletSessionStore } from "./sessionStore";

/** Filled once the Signing Layer iframe finishes loading / wallet handshake. */
const configProvider: IConfigProvider = new ConfigProvider();
const owsProvider: IOWSProvider = new OWSProvider(configProvider);
const chainRepository: IChainRepository = new HardcodedChainRepository();
const blockchainProvider: IBlockchainProvider =
  new SupportedChainsBlockchainProvider(chainRepository);
const addressUtils = new AddressUtils(blockchainProvider);
const eventBus: IEventBus = new EventBus();
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

const transactionService: ITransactionService = new TransactionService({
  chainRepository,
  relayerRepository: oneshotRelayerRepository,
  blockchain: blockchainProvider,
  transactionUtils,
  owsProvider,
  withPasskeyPrompt,
});

const credentialRepository = new CachedRelayerCredentialRepository({
  client: new RelayerCredentialsClient(configProvider),
  configProvider,
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
  openCreateBackup: () => Promise<void>;
  openRestoreBackup: () => Promise<void>;
  loginWithPasskey: () => Promise<void>;
  createNewWalletFromUi: () => Promise<void>;
  persistBackup: (encryptedPrivateKey: string) => void;
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
    createNewWalletFromUi,
    ensureReady,
    ensureReadyRef,
    ensureOnboardedForSigning,
    onSigningAuthenticated,
    awaitSignerReady,
  } = useWalletAuth({
    signerRef,
    walletRef,
    awaitSignerRef,
    configProvider,
    credentialRepository,
  });

  const {
    listCredentials,
    getCredential,
    refreshCredentialsFromRelayer,
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
    ensureReady,
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
      await ensureReady();
      const owner = useWalletSessionStore.getState().evmAddress;
      const chain = await chainRepository.get(chainId);
      const prefetch =
        chain?.useRelayer && payment && owner
          ? await transactionService.prefetchForRelayerSend(chainId, owner)
          : undefined;
      const result = await transactionService.sendTransaction(
        chainId,
        { to, data, value },
        payment ? { ...payment, prefetch } : undefined,
      );
      await onSigningAuthenticated();
      return result.transactionHash;
    },
    [ensureReady, onSigningAuthenticated],
  );

  const openCreateBackup = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    const config = await configProvider.getConfig();
    const display = await wallet.requestDisplay(config.displayBackupSize);
    try {
      await pushModal<void>(({ id, resolve, reject }) => ({
        id,
        kind: "createBackup",
        resolve,
        reject,
      }));
    } finally {
      await display.hide();
    }
  }, []);

  const openRestoreBackup = useCallback(async () => {
    const encrypted = loadBackup();
    if (!encrypted) {
      window.alert("No backup found. Create a backup first.");
      return;
    }
    const wallet = walletRef.current;
    if (!wallet) return;
    const config = await configProvider.getConfig();
    const display = await wallet.requestDisplay(config.displayBackupSize);
    try {
      const restored = await pushModal<boolean>(({ id, resolve, reject }) => ({
        id,
        kind: "restoreBackup",
        encryptedPrivateKey: encrypted,
        resolve,
        reject,
      }));
      if (restored) {
        setUnlocked(true);
        useWalletSessionStore.getState().setWalletCreated(true);
        await refreshAddresses();
      }
    } finally {
      await display.hide();
    }
  }, [refreshAddresses, setUnlocked]);

  const persistBackup = useCallback((encryptedPrivateKey: string) => {
    saveBackup(encryptedPrivateKey);
  }, []);

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
      listTrackedAssets,
      addTrackedAsset,
      removeTrackedAsset,
      getKnownAsset,
      resolveTrackedAsset,
      requestBalanceRefresh,
      listAssetActivity,
      recordSentActivity,
      sendTransaction,
      openCreateBackup,
      openRestoreBackup,
      loginWithPasskey,
      createNewWalletFromUi,
      persistBackup,
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
      listTrackedAssets,
      addTrackedAsset,
      removeTrackedAsset,
      getKnownAsset,
      resolveTrackedAsset,
      requestBalanceRefresh,
      listAssetActivity,
      recordSentActivity,
      sendTransaction,
      openCreateBackup,
      openRestoreBackup,
      loginWithPasskey,
      createNewWalletFromUi,
      persistBackup,
    ],
  );

  return (
    <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
  );
}
