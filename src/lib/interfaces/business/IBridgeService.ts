import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
} from "@1shotapi/ows-types";
import type { ECctpTransferSpeed } from "../../types/enum/ECctpTransferSpeed";
import type { KnownAsset } from "../../types/domain/KnownAsset";
import type { SupportedChain } from "../../types/domain/SupportedChain";
import type { ICctpInFlightBurn } from "../data/ICircleRepository";
import type { IPaymentQuote } from "./ITransactionService";
import type { TokenAmount } from "../../types/primitives";

export interface ICctpQuoteParams {
  sourceChainId: EVMChainId;
  destChainId: EVMChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: EVMAccountAddress;
}

export interface ICctpBridgeQuote {
  sourceChainId: EVMChainId;
  destChainId: EVMChainId;
  amountAtoms: bigint;
  speed: ECctpTransferSpeed;
  owner: EVMAccountAddress;
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
}

export interface ICctpBridgePayment {
  paymentToken: EVMAccountAddress;
  feeAtoms: TokenAmount;
}

export interface ICctpBridgeResult {
  burnTxHash: EVMTransactionHash;
  forwardTxHash?: EVMTransactionHash;
}

export interface ICctpPollProgress {
  burnTxHash: EVMTransactionHash;
  forwardTxHash?: EVMTransactionHash;
}

/**
 * Gasless CCTP V2 USDC bridge via native TokenMessengerV2 + Circle Forwarding
 * Service, submitted through the 1Shot relayer.
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
  ): Promise<EVMTransactionHash>;
}

export const IBridgeServiceType = Symbol.for("IBridgeService");
