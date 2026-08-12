import { create } from "zustand";
import {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { DEFAULT_CHAIN_ID } from "../lib/implementations/data/HardcodedChainRepository";
import {
  isWalletCreated,
  loadCachedEvmAddress,
  loadCachedSolanaAddress,
} from "../storage";

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
  chainId: EVMChainId;
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
  ) => void;
  setChainId: (chainId: EVMChainId) => void;
  setCredentialCount: (count: number) => void;
  setTrackedAssetCount: (count: number) => void;
  setMode: (mode: EWalletMode) => void;
  setFocusedAssetAddress: (address: EVMAccountAddress | null) => void;
  focusWallet: (
    chainId: EVMChainId,
    assetAddress: EVMAccountAddress,
  ) => void;
  unfocusWallet: () => void;
}

function initialEmbedded(): boolean {
  return typeof window !== "undefined" && window.parent !== window;
}

function initialWalletCreated(): boolean {
  return typeof window !== "undefined" ? isWalletCreated() : false;
}

function initialEvmAddress(): EVMAccountAddress {
  if (typeof window === "undefined") {
    return EVMAccountAddress("0x0");
  }
  return loadCachedEvmAddress() ?? EVMAccountAddress("0x0");
}

function initialSolanaAddress(): SolanaAccountAddress {
  if (typeof window === "undefined") {
    return SolanaAccountAddress("—");
  }
  return loadCachedSolanaAddress() ?? SolanaAccountAddress("—");
}

export const useWalletSessionStore = create<IWalletSessionState>((set) => ({
  ready: false,
  signerReady: false,
  bootError: null,
  embedded: initialEmbedded(),
  unlocked: false,
  walletCreated: initialWalletCreated(),
  evmAddress: initialEvmAddress(),
  solanaAddress: initialSolanaAddress(),
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
  setAddresses: (evmAddress, solanaAddress) =>
    set({ evmAddress, solanaAddress }),
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
