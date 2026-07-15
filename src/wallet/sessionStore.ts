import { create } from "zustand";
import {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
} from "@1shotapi/ows-types";
import { DEMO_CHAINS } from "../ows/demoChains";
import {
  isWalletCreated,
  loadCachedEvmAddress,
  loadCachedSolanaAddress,
} from "../storage";

export interface IWalletSessionState {
  ready: boolean;
  bootError: string | null;
  embedded: boolean;
  unlocked: boolean;
  walletCreated: boolean;
  evmAddress: EVMAccountAddress;
  solanaAddress: SolanaAccountAddress;
  chainId: EVMChainId;
  credentialCount: number;

  setReady: (ready: boolean) => void;
  setBootError: (error: string | null) => void;
  setUnlocked: (unlocked: boolean) => void;
  setWalletCreated: (created: boolean) => void;
  setAddresses: (
    evm: EVMAccountAddress,
    solana: SolanaAccountAddress,
  ) => void;
  setChainId: (chainId: EVMChainId) => void;
  setCredentialCount: (count: number) => void;
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
  bootError: null,
  embedded: initialEmbedded(),
  unlocked: false,
  walletCreated: initialWalletCreated(),
  evmAddress: initialEvmAddress(),
  solanaAddress: initialSolanaAddress(),
  chainId: DEMO_CHAINS[0]!.chainId,
  credentialCount: 0,

  setReady: (ready) => set({ ready }),
  setBootError: (bootError) => set({ bootError }),
  setUnlocked: (unlocked) => set({ unlocked }),
  setWalletCreated: (walletCreated) => set({ walletCreated }),
  setAddresses: (evmAddress, solanaAddress) =>
    set({ evmAddress, solanaAddress }),
  setChainId: (chainId) => set({ chainId }),
  setCredentialCount: (credentialCount) => set({ credentialCount }),
}));
