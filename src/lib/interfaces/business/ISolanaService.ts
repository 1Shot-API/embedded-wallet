import type {
  SolanaAccountAddress,
  SolanaChainId,
  SolanaTransactionSignature,
} from "@1shotapi/ows-types";

import type { SolanaLamports } from "../../types/primitives/SolanaLamports";

export interface ISolanaSendParams {
  chainId: SolanaChainId;
  from: SolanaAccountAddress;
  to: SolanaAccountAddress;
  /** Amount in lamports (not including network fee). */
  amountLamports: SolanaLamports;
}

export interface ISolanaSendResult {
  signature: SolanaTransactionSignature;
  /** Estimated prioritization / base fee reserve used when building (lamports). */
  feeLamports: SolanaLamports;
}

export interface ISolanaService {
  getBalance(
    chainId: SolanaChainId,
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports>;

  send(params: ISolanaSendParams): Promise<ISolanaSendResult>;
}

export const ISolanaServiceType = Symbol.for("ISolanaService");
