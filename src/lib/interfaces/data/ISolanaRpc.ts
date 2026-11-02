import type {
  SolanaAccountAddress,
  SolanaATAAddress,
  SolanaChainId,
  SolanaMintAddress,
  SolanaProgramAddress,
  SolanaTransactionHash,
} from "@1shotapi/ows-types";

import type { SolanaLamports } from "../../types/primitives/SolanaLamports";

export interface ISolanaBlockhash {
  blockhash: string;
  lastValidBlockHeight: bigint;
}

export interface ISolanaSimulateResult {
  /** Non-null when the RPC reports a simulation error. */
  err: unknown | null;
  logs?: string[];
}

export interface ISolanaTokenAccountBalance {
  amount: bigint;
  decimals: number;
}

/** jsonParsed mint account fields used when adding an arbitrary SPL. */
export interface ISolanaMintInfo {
  decimals: number;
  /** Token or Token-2022 program that owns the mint account. */
  tokenProgram: SolanaProgramAddress;
}

export interface ISolanaSignatureInfo {
  signature: SolanaTransactionHash;
  /** Unix seconds when available; null when the RPC omits blockTime. */
  blockTime: number | null;
  err: unknown | null;
}

/** Minimal jsonParsed transaction fields used for SPL activity. */
export interface ISolanaParsedTransaction {
  signature: SolanaTransactionHash;
  blockTime: number | null;
  err: unknown | null;
  /** Token-account balance rows from meta.preTokenBalances / postTokenBalances. */
  preTokenBalances: ISolanaParsedTokenBalance[];
  postTokenBalances: ISolanaParsedTokenBalance[];
}

export interface ISolanaParsedTokenBalance {
  accountIndex: number;
  mint: string;
  owner: string | null;
  amount: bigint;
  decimals: number;
  /** Account pubkey at this meta index when present in accountKeys. */
  accountAddress: string | null;
}

export interface ISolanaRpc {
  getBalance(
    chainId: SolanaChainId,
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports>;

  getLatestBlockhash(chainId: SolanaChainId): Promise<ISolanaBlockhash>;

  /**
   * Prefight simulation. Prefer `sigVerify: false` so unsigned wires work
   * before the passkey ceremony.
   */
  simulateTransaction(
    chainId: SolanaChainId,
    wireTransactionBase64: string,
  ): Promise<ISolanaSimulateResult>;

  sendRawTransaction(
    chainId: SolanaChainId,
    wireTransactionBase64: string,
  ): Promise<SolanaTransactionHash>;

  /** True when the account exists on-chain (data length &gt; 0). */
  accountExists(
    chainId: SolanaChainId,
    address: SolanaAccountAddress | SolanaATAAddress | SolanaMintAddress,
  ): Promise<boolean>;

  /**
   * Owner program of a mint account (classic Token vs Token-2022).
   * Throws if the account is missing or not a mint.
   */
  getMintTokenProgram(
    chainId: SolanaChainId,
    mint: SolanaMintAddress,
  ): Promise<SolanaProgramAddress>;

  /**
   * jsonParsed mint probe: decimals + owning token program.
   * Throws if missing or not a Token / Token-2022 mint.
   */
  getMintInfo(
    chainId: SolanaChainId,
    mint: SolanaMintAddress,
  ): Promise<ISolanaMintInfo>;

  getTokenAccountBalance(
    chainId: SolanaChainId,
    tokenAccount: SolanaATAAddress,
  ): Promise<ISolanaTokenAccountBalance>;

  /** Recent signatures for an account (wallet or ATA), newest first. */
  getSignaturesForAddress(
    chainId: SolanaChainId,
    address: SolanaAccountAddress | SolanaATAAddress,
    limit: number,
  ): Promise<ISolanaSignatureInfo[]>;

  /** jsonParsed transaction for SPL balance-delta activity. */
  getParsedTransaction(
    chainId: SolanaChainId,
    signature: SolanaTransactionHash,
  ): Promise<ISolanaParsedTransaction | null>;
}

export const ISolanaRpcType = Symbol.for("ISolanaRpc");
