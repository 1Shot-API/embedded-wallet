import { create } from "zustand";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  type BitcoinChainId,
  type BitcoinSegwitAccountAddress,
  EVMAccountAddress,
  type OWSChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { DEFAULT_CHAIN_ID } from "../lib/implementations/data/HardcodedChainRepository";
import { reconcileCachedWalletSession } from "../storage";

/** Host-controlled shell mode — users cannot switch between these. */
export enum EWalletMode {
  General = "general",
  Focused = "focused",
}

export interface IWalletSessionState {
  ready: boolean;
  /** Signing Layer iframe loaded (`OWSSigner.create` resolved). */
  signerReady: boolean;
  bootError: string | null;
  embedded: boolean;
  unlocked: boolean;
  walletCreated: boolean;
  evmAddress: EVMAccountAddress;
  solanaAddress: SolanaAccountAddress;
  bitcoinMainnetAddress: BitcoinSegwitAccountAddress | null;
  bitcoinTestnetAddress: BitcoinSegwitAccountAddress | null;
  chainId: OWSChainId;
  credentialCount: number;
  /** Bumped on tracked-asset add/remove so Balances tab reloads. */
  trackedAssetCount: number;
  mode: EWalletMode;
  focusedAssetAddress: EVMAccountAddress | null;

  setReady: (ready: boolean) => void;
  setSignerReady: (ready: boolean) => void;
  setBootError: (error: string | null) => void;
  setUnlocked: (unlocked: boolean) => void;
  setWalletCreated: (created: boolean) => void;
  setAddresses: (
    evm: EVMAccountAddress,
    solana: SolanaAccountAddress,
    bitcoinMainnet?: BitcoinSegwitAccountAddress | null,
    bitcoinTestnet?: BitcoinSegwitAccountAddress | null,
  ) => void;
  setBitcoinAddress: (
    chainId: BitcoinChainId,
    address: BitcoinSegwitAccountAddress,
  ) => void;
  setChainId: (chainId: OWSChainId) => void;
  setCredentialCount: (count: number) => void;
  setTrackedAssetCount: (count: number) => void;
  setMode: (mode: EWalletMode) => void;
  setFocusedAssetAddress: (address: EVMAccountAddress | null) => void;
  focusWallet: (
    chainId: OWSChainId,
    assetAddress: EVMAccountAddress,
  ) => void;
  unfocusWallet: () => void;
}

function initialEmbedded(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

function hydrateSessionFromCache(): {
  walletCreated: boolean;
  unlocked: boolean;
  evmAddress: EVMAccountAddress;
  solanaAddress: SolanaAccountAddress;
  bitcoinMainnetAddress: BitcoinSegwitAccountAddress | null;
  bitcoinTestnetAddress: BitcoinSegwitAccountAddress | null;
} {
  if (typeof window === "undefined") {
    return {
      walletCreated: false,
      unlocked: false,
      evmAddress: EVMAccountAddress("0x0"),
      solanaAddress: SolanaAccountAddress("—"),
      bitcoinMainnetAddress: null,
      bitcoinTestnetAddress: null,
    };
  }
  const cached = reconcileCachedWalletSession();
  return {
    walletCreated: cached.walletCreated,
    unlocked: cached.walletCreated,
    evmAddress: cached.evmAddress ?? EVMAccountAddress("0x0"),
    solanaAddress: cached.solanaAddress ?? SolanaAccountAddress("—"),
    bitcoinMainnetAddress: cached.bitcoinMainnetAddress ?? null,
    bitcoinTestnetAddress: cached.bitcoinTestnetAddress ?? null,
  };
}

const hydratedSession = hydrateSessionFromCache();

export const useWalletSessionStore = create<IWalletSessionState>((set) => ({
  ready: false,
  signerReady: false,
  bootError: null,
  embedded: initialEmbedded(),
  unlocked: hydratedSession.unlocked,
  walletCreated: hydratedSession.walletCreated,
  evmAddress: hydratedSession.evmAddress,
  solanaAddress: hydratedSession.solanaAddress,
  bitcoinMainnetAddress: hydratedSession.bitcoinMainnetAddress,
  bitcoinTestnetAddress: hydratedSession.bitcoinTestnetAddress,
  chainId: DEFAULT_CHAIN_ID,
  credentialCount: 0,
  trackedAssetCount: 0,
  mode: EWalletMode.General,
  focusedAssetAddress: null,

  setReady: (ready) => set({ ready }),
  setSignerReady: (signerReady) => set({ signerReady }),
  setBootError: (bootError) => set({ bootError }),
  setUnlocked: (unlocked) => set({ unlocked }),
  setWalletCreated: (walletCreated) => set({ walletCreated }),
  setAddresses: (
    evmAddress,
    solanaAddress,
    bitcoinMainnet = null,
    bitcoinTestnet = null,
  ) =>
    set((state) => ({
      evmAddress,
      solanaAddress,
      bitcoinMainnetAddress: bitcoinMainnet ?? state.bitcoinMainnetAddress,
      bitcoinTestnetAddress: bitcoinTestnet ?? state.bitcoinTestnetAddress,
    })),
  setBitcoinAddress: (chainId, address) =>
    set(
      chainId === BITCOIN_MAINNET_CHAIN_ID
        ? { bitcoinMainnetAddress: address }
        : { bitcoinTestnetAddress: address },
    ),
  setChainId: (chainId) => set({ chainId }),
  setCredentialCount: (credentialCount) => set({ credentialCount }),
  setTrackedAssetCount: (trackedAssetCount) => set({ trackedAssetCount }),
  setMode: (mode) => set({ mode }),
  setFocusedAssetAddress: (focusedAssetAddress) => set({ focusedAssetAddress }),
  focusWallet: (chainId, focusedAssetAddress) =>
    set({
      mode: EWalletMode.Focused,
      chainId,
      focusedAssetAddress,
    }),
  unfocusWallet: () =>
    set({
      mode: EWalletMode.General,
      focusedAssetAddress: null,
    }),
}));
