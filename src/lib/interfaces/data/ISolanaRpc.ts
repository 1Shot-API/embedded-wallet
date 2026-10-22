import type {
  SolanaAccountAddress,
  SolanaChainId,
  SolanaTransactionSignature,
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
  ): Promise<SolanaTransactionSignature>;
}

export const ISolanaRpcType = Symbol.for("ISolanaRpc");
