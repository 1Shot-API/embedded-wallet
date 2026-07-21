import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";
import { OWSSigner } from "@1shotapi/ows-signer-utils";
import { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  HexString,
  OwsUserRejectedError,
  type CredentialId,
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type CredentialSummary,
  type EVMAccountAddress,
  type EVMChainId,
  type EVMTransactionHash,
  type StoredCredential,
} from "@1shotapi/ows-types";
import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import { DEMO_HOLDER_PRIVATE_JWK } from "../demo/demo-keys";
import { InMemoryIssuerTrustRegistry } from "../demo/in-memory-trust-registry";
import { CachedRelayerCredentialRepository } from "../credentials/CachedRelayerCredentialRepository";
import {
  DemoWalletAttestationProvider,
  FetchUtils,
  HttpOid4vciClient,
  HttpOid4vpClient,
  ParseUtils,
} from "@1shotapi/ows-oid4";
import { DEMO_CHAINS } from "../ows/demoChains";
import {
  registerAccountConnect,
  type AccountConnectStorage,
} from "../ows/registerAccountConnect";
import { registerApprovalSigning } from "../ows/registerApprovalSigning";
import { registerCredentialsProvider } from "../ows/registerCredentialsProvider";
import { RelayerCredentialsClient } from "../relayer/RelayerCredentialsClient";
import { registerSetStyleRpc } from "../style";
import { wrapSignerWithPasskeyPrompts } from "./wrapSignerWithPasskeyPrompts";
import {
  HardcodedKnownAssetRepository,
  LocalStorageTrackedAssetRepository,
  BlockscoutAssetActivityRepository,
  OneshotRelayerRepository,
} from "../lib/implementations/data";
import {
  DemoChainsBlockchainProvider,
  EventBus,
  TransactionUtils,
} from "../lib/implementations/utils";
import type { IEventBus } from "../lib/interfaces/utils";
import type { IRecordSentActivityParams } from "../lib/interfaces/data";
import type {
  AssetActivity,
  KnownAsset,
  TrackedAsset,
} from "../lib/types/domain";
import { RefreshBalanceRequestedEvent } from "../lib/types/events";
import type { TrackedAssetId } from "../lib/types/primitives";
import { registerAddAssetRpc } from "./registerAddAsset";
import { registerFocusModeRpc } from "./registerFocusMode";
import {
  isWalletCreated,
  loadBackup,
  loadCachedEvmAddress,
  loadCredentialId,
  saveBackup,
  saveCachedAddresses,
  saveWalletCreated,
} from "../storage";
import { useModalStore } from "./modalStore";
import type { ActiveModal, WalletSetupChoice } from "./modalTypes";
import { useWalletSessionStore } from "./sessionStore";

/** Filled once the Signing Layer iframe finishes loading. */
const signerHolder: { current: OWSSigner | null } = { current: null };
const rpcHelperHolder: { current: RpcHelper | null } = { current: null };

const blockchainProvider = new DemoChainsBlockchainProvider();
const eventBus: IEventBus = new EventBus();
const transactionUtils = new TransactionUtils();
const knownAssetRepository = new HardcodedKnownAssetRepository(
  blockchainProvider,
);
const trackedAssetRepository = new LocalStorageTrackedAssetRepository(
  blockchainProvider,
  eventBus,
);
const assetActivityRepository = new BlockscoutAssetActivityRepository(eventBus);
const oneshotRelayerRepository = new OneshotRelayerRepository({
  blockchain: blockchainProvider,
  getSigner: () => {
    if (!signerHolder.current) {
      throw new Error("Signing Layer not ready");
    }
    return signerHolder.current;
  },
  getChainRpc: () => {
    if (!rpcHelperHolder.current) {
      throw new Error("RPC helper not ready");
    }
    return rpcHelperHolder.current;
  },
});

const credentialRepository = new CachedRelayerCredentialRepository({
  client: new RelayerCredentialsClient(),
  getSigner: () => {
    if (!signerHolder.current) {
      throw new Error("Signing Layer not ready");
    }
    return signerHolder.current;
  },
});
const issuerTrust = new InMemoryIssuerTrustRegistry();
const fetchUtils = new FetchUtils();
const parseUtils = new ParseUtils();
const oid4vci = new HttpOid4vciClient(fetchUtils, parseUtils);
const oid4vp = new HttpOid4vpClient(fetchUtils);
const attestationProvider = new DemoWalletAttestationProvider({
  privateJwk: DEMO_HOLDER_PRIVATE_JWK,
  issuer: "ows-demo-wallet",
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

/**
 * Proxy that forwards to a real {@link OWSSigner} once `awaitSigner` resolves.
 * Register Postmate handlers with this so `wallet.start()` can run before the
 * nested Signing Layer iframe finishes loading (Postmate parents give up after
 * ~2.5s of handshake retries).
 */
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

/** Imperative wallet APIs that need refs / boot (not UI session state). */
export type WalletContextValue = {
  chains: typeof DEMO_CHAINS;
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
  requestBalanceRefresh: (id?: TrackedAssetId) => void;
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
   * callers already collected amount/recipient. Routes to the relayer only.
   */
  sendTransaction: (
    chainId: EVMChainId,
    to: EVMAccountAddress,
    data: HexString,
    value?: bigint,
  ) => Promise<EVMTransactionHash>;
  eventBus: IEventBus;
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

function pushModal<T>(
  build: (handlers: {
    id: string;
    resolve: (value: T) => void;
    reject: (error: unknown) => void;
  }) => ActiveModal,
): Promise<T> {
  return useModalStore.getState().push(build);
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const signerContainerRef = useRef<HTMLDivElement | null>(null);
  const walletRef = useRef<OWSWallet | null>(null);
  const signerRef = useRef<OWSSigner | null>(null);
  const rpcHelperRef = useRef<RpcHelper | null>(null);
  const unlockInFlightRef = useRef<Promise<void> | undefined>(undefined);

  /** Resolves once `OWSSigner.create` finishes; set during boot. */
  const awaitSignerRef = useRef<(() => Promise<OWSSigner>) | null>(null);

  const setUnlocked = useCallback((value: boolean) => {
    useWalletSessionStore.getState().setUnlocked(value);
  }, []);

  const refreshAddresses = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) return;
    const evm = await signer.evm.getAccountAddress();
    const solana = await signer.solana.getAccountAddress();
    useWalletSessionStore.getState().setAddresses(evm, solana);
    saveCachedAddresses(evm, solana);
  }, []);

  const refreshCredentialCount = useCallback(async () => {
    const listed = await credentialRepository.list();
    useWalletSessionStore.getState().setCredentialCount(listed.length);
  }, []);

  const promptPasskeyName = useCallback((): Promise<string | null> => {
    return pushModal<string | null>(({ id, resolve }) => ({
      id,
      kind: "passkeyName",
      resolve,
    }));
  }, []);

  const requestWalletSetupChoice =
    useCallback((): Promise<WalletSetupChoice> => {
      return pushModal<WalletSetupChoice>(({ id, resolve }) => ({
        id,
        kind: "walletSetup",
        resolve,
      }));
    }, []);

  const loginWithPasskey = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const result = await signer.getPublicKey({ discoverable: true });
    const credentialId = result.credentialId ?? signer.getCredentialId();
    if (!credentialId) {
      throw new Error("Passkey login succeeded but credential id missing");
    }
    // Persist credentialId before relayer assert / recover (needed for assertions).
    // Defer walletCreated/unlocked until after recover so MainPanel mounts with a
    // populated credentials cache (CredentialsTab loads on mount).
    saveWalletCreated(credentialId);
    await refreshAddresses();
    try {
      await credentialRepository.refreshFromRelayer();
      await refreshCredentialCount();
    } catch (error: unknown) {
      console.warn(
        "[credentials] recover after login failed (passkey may be unregistered)",
        error,
      );
    }
    useWalletSessionStore.getState().setWalletCreated(true);
    setUnlocked(true);
  }, [refreshAddresses, refreshCredentialCount, setUnlocked]);

  const createNewWallet = useCallback(
    async (accountName: string) => {
      const signer = signerRef.current;
      if (!signer) throw new Error("Signer not ready");
      const created = await signer.createCredential(accountName, {
        rpName: "Open Wallet",
        userDisplayName: accountName,
      });
      const credentialId =
        created.credentialId ?? signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey created but credential id missing");
      }
      if (!created.cosePublicKey) {
        throw new Error(
          "Passkey created but authenticator public key missing — cannot register with relayer",
        );
      }
      // Persist credentialId first so relayer assertions can target this passkey.
      saveWalletCreated(credentialId);
      // Only chance to bind authenticator public key — register immediately.
      await credentialRepository.registerPasskey(created.cosePublicKey);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
      setUnlocked(true);
    },
    [refreshAddresses, setUnlocked],
  );

  const createNewWalletFromUi = useCallback(async () => {
    const name = await promptPasskeyName();
    if (!name) {
      throw new OwsUserRejectedError("User cancelled passkey creation");
    }
    await createNewWallet(name);
  }, [createNewWallet, promptPasskeyName]);

  const unlockWithStoredCredential = useCallback(async () => {
    const signer = signerRef.current;
    if (!signer) throw new Error("Signer not ready");
    const storedCredentialId = loadCredentialId();
    if (storedCredentialId) {
      const result = await signer.getPublicKey({
        credentialId: storedCredentialId,
      });
      const credentialId = result.credentialId ?? signer.getCredentialId();
      if (!credentialId) {
        throw new Error("Passkey unlock succeeded but credential id missing");
      }
      saveWalletCreated(credentialId);
      useWalletSessionStore.getState().setWalletCreated(true);
      await refreshAddresses();
      // Cross-origin / cleared credential cache: recover before host present/list.
      try {
        const listed = await credentialRepository.list();
        if (listed.length === 0) {
          await credentialRepository.refreshFromRelayer();
          await refreshCredentialCount();
        }
      } catch (error: unknown) {
        console.warn(
          "[credentials] recover after unlock failed (passkey may be unregistered)",
          error,
        );
      }
      setUnlocked(true);
      return;
    }
    await loginWithPasskey();
  }, [
    loginWithPasskey,
    refreshAddresses,
    refreshCredentialCount,
    setUnlocked,
  ]);

  const runSetupFlow = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) throw new Error("Wallet not ready");
    const display = await wallet.requestDisplay({ width: 420, height: 480 });
    try {
      const choice = await requestWalletSetupChoice();
      if (choice === "cancel") {
        throw new OwsUserRejectedError("User cancelled wallet setup");
      }
      if (choice === "login") {
        await loginWithPasskey();
        return;
      }
      await createNewWalletFromUi();
    } finally {
      await display.hide();
    }
  }, [createNewWalletFromUi, loginWithPasskey, requestWalletSetupChoice]);

  const ensureReadyImpl = useCallback(async () => {
    if (useWalletSessionStore.getState().unlocked) {
      return;
    }
    if (unlockInFlightRef.current) {
      await unlockInFlightRef.current;
      return;
    }

    unlockInFlightRef.current = (async () => {
      if (isWalletCreated()) {
        await unlockWithStoredCredential();
        return;
      }
      await runSetupFlow();
    })();

    try {
      await unlockInFlightRef.current;
    } finally {
      unlockInFlightRef.current = undefined;
    }
  }, [runSetupFlow, unlockWithStoredCredential]);

  const ensureReadyRef = useRef(ensureReadyImpl);
  ensureReadyRef.current = ensureReadyImpl;

  /**
   * Stable forever: always reads {@link awaitSignerRef} / {@link ensureReadyRef}
   * so boot-time registrations never capture a stale unlock implementation.
   */
  const awaitSignerReady = useCallback(async (): Promise<OWSSigner> => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    return awaitSigner();
  }, []);

  const ensureReady = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    await ensureReadyRef.current();
  }, []);

  /**
   * Signed-action gate: only run setup/login when no credential exists.
   * With a known credential, the signing ceremony itself unlocks.
   */
  const ensureOnboardedForSigning = useCallback(async () => {
    const awaitSigner = awaitSignerRef.current;
    if (!awaitSigner) {
      throw new Error(
        "Signing Layer not started — wallet boot has not begun yet",
      );
    }
    await awaitSigner();
    if (isWalletCreated()) {
      return;
    }
    await ensureReadyRef.current();
  }, []);

  const onSigningAuthenticated = useCallback(async () => {
    await refreshAddresses();
    useWalletSessionStore.getState().setWalletCreated(true);
    setUnlocked(true);
  }, [refreshAddresses, setUnlocked]);

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

  const listCredentials = useCallback(async () => {
    return credentialRepository.list();
  }, []);

  const getCredential = useCallback(async (credentialId: CredentialId) => {
    return credentialRepository.get(credentialId);
  }, []);

  const refreshCredentialsFromRelayer = useCallback(async () => {
    await ensureReady();
    await credentialRepository.refreshFromRelayer();
    await refreshCredentialCount();
  }, [ensureReady, refreshCredentialCount]);

  const refreshTrackedAssetCount = useCallback(async () => {
    const owner = useWalletSessionStore.getState().evmAddress;
    const listed = await trackedAssetRepository.list(owner);
    useWalletSessionStore.getState().setTrackedAssetCount(listed.length);
  }, [trackedAssetRepository]);

  const listTrackedAssets = useCallback(async () => {
    const owner = useWalletSessionStore.getState().evmAddress;
    return trackedAssetRepository.list(owner);
  }, [trackedAssetRepository]);

  const addTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      const resolved = await knownAssetRepository.resolveForTracking(
        chainId,
        address,
        owner,
      );
      const tracked = await trackedAssetRepository.add(resolved, owner);
      await refreshTrackedAssetCount();
      return tracked;
    },
    [
      knownAssetRepository,
      refreshTrackedAssetCount,
      trackedAssetRepository,
    ],
  );

  const removeTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      await trackedAssetRepository.remove(chainId, address);
      await refreshTrackedAssetCount();
    },
    [refreshTrackedAssetCount, trackedAssetRepository],
  );

  const getKnownAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      return knownAssetRepository.getKnownAsset(chainId, address);
    },
    [knownAssetRepository],
  );

  const resolveTrackedAsset = useCallback(
    async (chainId: EVMChainId, address: EVMAccountAddress) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      const listed = await trackedAssetRepository.list(owner);
      const existing = listed.find(
        (asset) =>
          asset.chainId === chainId && asset.address === address,
      );
      if (existing) return existing;
      const resolved = await knownAssetRepository.resolveForTracking(
        chainId,
        address,
        owner,
      );
      // add() is idempotent if a concurrent caller already tracked the asset.
      const tracked = await trackedAssetRepository.add(resolved, owner);
      await refreshTrackedAssetCount();
      return tracked;
    },
    [
      knownAssetRepository,
      refreshTrackedAssetCount,
      trackedAssetRepository,
    ],
  );

  const requestBalanceRefresh = useCallback((id?: TrackedAssetId) => {
    eventBus.emit(new RefreshBalanceRequestedEvent(id));
  }, []);

  const listAssetActivity = useCallback(
    async (
      owner: EVMAccountAddress,
      asset: TrackedAsset,
      limit?: number,
    ) => {
      return assetActivityRepository.list({ owner, asset, limit });
    },
    [],
  );

  const recordSentActivity = useCallback(
    async (params: IRecordSentActivityParams) => {
      return assetActivityRepository.recordSent(params);
    },
    [],
  );

  /**
   * In-wallet send path: setup gate → relayer prepare/sign/broadcast → unlock.
   * Host EIP-1193 sends use SignHelper → approveAndSignTransaction instead.
   */
  const sendTransaction = useCallback(
    async (
      chainId: EVMChainId,
      to: EVMAccountAddress,
      data: HexString,
      value?: bigint,
    ) => {
      await ensureOnboardedForSigning();
      const result = await oneshotRelayerRepository.sendTransaction(
        chainId,
        to,
        data,
        value,
      );
      await onSigningAuthenticated();
      return result.transactionHash;
    },
    [ensureOnboardedForSigning, onSigningAuthenticated],
  );

  const openCreateBackup = useCallback(async () => {
    const wallet = walletRef.current;
    if (!wallet) return;
    const display = await wallet.requestDisplay({ width: 480, height: 420 });
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
    const display = await wallet.requestDisplay({ width: 480, height: 420 });
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

  useEffect(() => {
    let cancelled = false;
    const session = useWalletSessionStore.getState();

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
        signerHolder.current = loaded;
        return loaded;
      };
      awaitSignerRef.current = awaitSigner;
      const signer = createDeferredSigner(awaitSigner);

      const wallet = OWSWallet.prepare({ debug: true });
      walletRef.current = wallet;

      const ask = <T,>(
        build: (handlers: {
          id: string;
          resolve: (value: T) => void;
          reject: (error: unknown) => void;
        }) => ActiveModal,
      ) => pushModal(build);

      registerSetStyleRpc(wallet);

      registerAccountConnect(wallet, signer, {
        storage: walletStorage,
        ensureReady,
        requestConnectApproval: () =>
          ask<boolean>(({ id, resolve }) => ({
            id,
            kind: "connect",
            resolve,
          })),
      });

      const defaultChainId = DEMO_CHAINS[0]!.chainId;
      const rpcHelper = new RpcHelper(
        new Map(DEMO_CHAINS.map((chain) => [chain.chainId, chain.rpcUrl])),
        wallet,
        signer,
        { defaultChainId },
      );
      rpcHelperRef.current = rpcHelper;
      rpcHelperHolder.current = rpcHelper;
      session.setChainId(rpcHelper.getChainId());
      rpcHelper.events.on("chainChanged", (next) => {
        useWalletSessionStore.getState().setChainId(next);
      });

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
          const transfer = transactionUtils.tryDecodeErc20Transfer(
            request.to,
            request.data,
          );
          let approved: boolean;
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
            approved = await ask<boolean>(({ id, resolve }) => ({
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
                  DEMO_CHAINS,
                ),
              },
              resolve,
            }));
          } else {
            approved = await ask<boolean>(({ id, resolve }) => ({
              id,
              kind: "sendTransaction",
              request,
              resolve,
            }));
          }
          if (!approved) {
            throw new OwsUserRejectedError(
              "User rejected the transaction request",
            );
          }

          if (!request.to) {
            throw new OwsUserRejectedError(
              "Contract creation is not supported yet",
            );
          }

          const valueRaw = String(request.value);
          const value =
            valueRaw && valueRaw !== "0x0" && valueRaw !== "0x"
              ? BigInt(valueRaw)
              : undefined;
          const result = await oneshotRelayerRepository.sendTransaction(
            request.chainId,
            request.to,
            request.data,
            value,
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
    };
    // Boot once; handlers close over ensureReady via ensureReadyRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional mount-only boot
  }, []);

  useEffect(() => {
    return eventBus.onRefreshBalanceRequested((event) => {
      const owner = useWalletSessionStore.getState().evmAddress;
      void trackedAssetRepository
        .getBalances(owner, event.trackedAssetId)
        .then(async (assets) => {
          useWalletSessionStore.getState().setTrackedAssetCount(
            (await trackedAssetRepository.list(owner)).length,
          );
          return assets;
        })
        .catch((error: unknown) => {
          console.error("[oneshot-wallet] balance refresh failed", error);
        });
    });
  }, []);

  const value = useMemo<WalletContextValue>(
    () => ({
      chains: DEMO_CHAINS,
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
      eventBus,
      openCreateBackup,
      openRestoreBackup,
      loginWithPasskey,
      createNewWalletFromUi,
      persistBackup,
    }),
    [
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
