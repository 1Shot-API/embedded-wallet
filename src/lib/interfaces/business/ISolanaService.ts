import type {
  SolanaAccountAddress,
  SolanaATAAddress,
  SolanaChainId,
  SolanaMintAddress,
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

export interface ISolanaEnsureAtaParams {
  chainId: SolanaChainId;
  owner: SolanaAccountAddress;
  mint: SolanaMintAddress;
}

export interface ISolanaEnsureAtaResult {
  ataAddress: SolanaATAAddress;
  /** True when CreateIdempotent was submitted (account was missing). */
  created: boolean;
  signature: SolanaTransactionSignature | null;
  /** Rent + fee reserve when creating; 0 when ATA already existed. */
  rentLamports: SolanaLamports;
}

export interface ISolanaSendSplParams {
  chainId: SolanaChainId;
  from: SolanaAccountAddress;
  to: SolanaAccountAddress;
  mint: SolanaMintAddress;
  /** Raw token amount in smallest units. */
  amount: bigint;
  decimals: number;
}

export interface ISolanaSendSplResult {
  signature: SolanaTransactionSignature;
  feeLamports: SolanaLamports;
  /** True when destination ATA CreateIdempotent was included. */
  createdRecipientAta: boolean;
  rentLamports: SolanaLamports;
}

export interface ISolanaService {
  getBalance(
    chainId: SolanaChainId,
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports>;

  send(params: ISolanaSendParams): Promise<ISolanaSendResult>;

  /**
   * Derive the owner’s ATA for `mint`; CreateIdempotent if missing.
   * User pays rent + fees when creating.
   */
  ensureAta(params: ISolanaEnsureAtaParams): Promise<ISolanaEnsureAtaResult>;

  /** Whether the recipient already has an ATA for `mint` (for confirm-sheet rent copy). */
  recipientAtaExists(
    chainId: SolanaChainId,
    owner: SolanaAccountAddress,
    mint: SolanaMintAddress,
  ): Promise<{ exists: boolean; ataAddress: SolanaATAAddress }>;

  sendSpl(params: ISolanaSendSplParams): Promise<ISolanaSendSplResult>;

  /** Typical ATA rent-exempt minimum (lamports) for UI estimates. */
  estimateAtaRentLamports(): SolanaLamports;
}

export const ISolanaServiceType = Symbol.for("ISolanaService");
