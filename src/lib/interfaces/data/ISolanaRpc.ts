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

export interface ISolanaRpc {
  getBalance(
    chainId: SolanaChainId,
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports>;

  getLatestBlockhash(chainId: SolanaChainId): Promise<ISolanaBlockhash>;

  sendRawTransaction(
    chainId: SolanaChainId,
    wireTransactionBase64: string,
  ): Promise<SolanaTransactionSignature>;
}

export const ISolanaRpcType = Symbol.for("ISolanaRpc");
