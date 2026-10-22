import type {
  SolanaAccountAddress,
  SolanaATAAddress,
  SolanaChainId,
  SolanaMintAddress,
  SolanaTransactionHash,
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
  signature: SolanaTransactionHash;
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
  signature: SolanaTransactionHash | null;
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
  signature: SolanaTransactionHash;
  feeLamports: SolanaLamports;
  /** True when destination ATA CreateIdempotent was included. */
  createdRecipientAta: boolean;
  rentLamports: SolanaLamports;
}

export interface ISolanaCloseAtaResult {
  signature: SolanaTransactionHash;
  feeLamports: SolanaLamports;
  /** Rent returned to the owner (estimate; actual amount is on-chain). */
  rentReclaimedLamports: SolanaLamports;
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

  /**
   * Close the owner’s ATA for `mint` and reclaim rent to `owner`.
   * Requires a zero token balance; throws otherwise.
   */
  closeAta(params: ISolanaEnsureAtaParams): Promise<ISolanaCloseAtaResult>;

  /** Typical ATA rent-exempt minimum (lamports) for UI estimates. */
  estimateAtaRentLamports(): SolanaLamports;
}

export const ISolanaServiceType = Symbol.for("ISolanaService");
