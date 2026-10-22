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

  getTokenAccountBalance(
    chainId: SolanaChainId,
    tokenAccount: SolanaATAAddress,
  ): Promise<ISolanaTokenAccountBalance>;
}

export const ISolanaRpcType = Symbol.for("ISolanaRpc");
