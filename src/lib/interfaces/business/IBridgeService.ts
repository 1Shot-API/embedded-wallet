import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
  OWSChainId,
  SolanaAccountAddress,
  TransactionHash,
} from "@1shotapi/ows-types";

import type { KnownAsset } from "../../types/domain/KnownAsset";
import type { SupportedChain } from "../../types/domain/SupportedChain";
import type { ECctpTransferSpeed } from "../../types/enum/ECctpTransferSpeed";
import type { TokenAmount } from "../../types/primitives";
import type { ICctpInFlightBurn } from "../data/ICircleRepository";

import type { IPaymentQuote, ITransactionWork } from "./ITransactionService";

export interface ICctpQuoteParams {
  sourceChainId: EVMChainId;
  destChainId: OWSChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: EVMAccountAddress;
  /**
   * Destination mint recipient as bytes32 hex.
   * Omit → pad `owner` (EVM dest). For Solana dest, prefer `solanaRecipient`
   * (ATA is derived) or pass ATA bytes32 explicitly.
   */
  mintRecipientBytes32?: HexString;
  /** Solana wallet pubkey when dest is Solana — ATA derived for USDC mint. */
  solanaRecipient?: SolanaAccountAddress;
}

export interface ICctpBridgeQuote {
  sourceChainId: EVMChainId;
  destChainId: OWSChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: EVMAccountAddress;
  mintRecipientBytes32: HexString;
  solanaRecipient?: SolanaAccountAddress;
  sourceUsdc: KnownAsset;
  destChain: SupportedChain;
  minFinalityThreshold: number;
  forwardFee: bigint;
  protocolFee: bigint;
  maxFee: bigint;
  totalBurn: bigint;
  netReceivedAtoms: bigint;
  paymentQuote: IPaymentQuote;
  burnCalldata: HexString;
  /** Approve (if needed) + burn ExactCalldata for fee estimate / submit. */
  relayerWork: ITransactionWork[];
}

export interface ICctpBridgePayment {
  paymentToken: EVMContractAddress;
  feeAtoms: TokenAmount;
  paymentChainId?: EVMChainId;
}

export interface ICctpBridgeResult {
  burnTxHash: TransactionHash;
  forwardTxHash?: TransactionHash;
}

export interface ICctpPollProgress {
  burnTxHash: TransactionHash;
  forwardTxHash?: TransactionHash;
}

/**
 * Gasless CCTP V2 USDC bridge via native TokenMessengerV2 + Circle Forwarding
 * Service, submitted through the 1Shot relayer (EVM source).
 */
export interface IBridgeService {
  listDestinations(sourceChainId: EVMChainId): Promise<SupportedChain[]>;

  quote(params: ICctpQuoteParams): Promise<ICctpBridgeQuote>;

  execute(
    quote: ICctpBridgeQuote,
    payment: ICctpBridgePayment,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<ICctpBridgeResult>;

  resume(owner: EVMAccountAddress): Promise<ICctpInFlightBurn | null>;

  pollUntilForwarded(
    inFlight: ICctpInFlightBurn,
    onProgress?: (progress: ICctpPollProgress) => void,
  ): Promise<TransactionHash>;
}

export const IBridgeServiceType = Symbol.for("IBridgeService");
