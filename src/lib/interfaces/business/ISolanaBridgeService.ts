import type {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
  SolanaChainId,
  SolanaMintAddress,
  TransactionHash,
} from "@1shotapi/ows-types";

import type { KnownAsset } from "../../types/domain/KnownAsset";
import type { SupportedChain } from "../../types/domain/SupportedChain";
import type { ECctpTransferSpeed } from "../../types/enum/ECctpTransferSpeed";
import type { ICctpInFlightBurn } from "../data/ICircleRepository";

import type { ICctpBridgeResult, ICctpPollProgress } from "./IBridgeService";

export interface ISolanaCctpQuoteParams {
  sourceChainId: SolanaChainId;
  destChainId: EVMChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: SolanaAccountAddress;
  /** EVM mint recipient (defaults to session EVM address in UI). */
  mintRecipient: EVMAccountAddress;
  /** Source USDC mint (catalog). */
  mint: SolanaMintAddress;
  /** Owner USDC ATA (must exist / be tracked). */
  burnAta: import("@1shotapi/ows-types").SolanaATAAddress;
}

export interface ISolanaCctpBridgeQuote {
  sourceChainId: SolanaChainId;
  destChainId: EVMChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: SolanaAccountAddress;
  mintRecipient: EVMAccountAddress;
  mint: SolanaMintAddress;
  burnAta: import("@1shotapi/ows-types").SolanaATAAddress;
  sourceUsdc: KnownAsset;
  destChain: SupportedChain;
  minFinalityThreshold: number;
  forwardFee: bigint;
  protocolFee: bigint;
  maxFee: bigint;
  totalBurn: bigint;
  netReceivedAtoms: bigint;
}

/**
 * Solana → EVM CCTP V2 USDC bridge: burn via Alchemy/Kit (no relayer),
 * Circle Forwarding mints on the EVM destination.
 */
export interface ISolanaBridgeService {
  listDestinations(sourceChainId: SolanaChainId): Promise<SupportedChain[]>;

  quote(params: ISolanaCctpQuoteParams): Promise<ISolanaCctpBridgeQuote>;

  execute(
    quote: ISolanaCctpBridgeQuote,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<ICctpBridgeResult>;

  resume(owner: SolanaAccountAddress): Promise<ICctpInFlightBurn | null>;

  pollUntilForwarded(
    inFlight: ICctpInFlightBurn,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<TransactionHash>;
}

export const ISolanaBridgeServiceType = Symbol.for("ISolanaBridgeService");
