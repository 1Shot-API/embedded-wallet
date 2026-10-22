import type {
  OWSChainId,
  TransactionHash,
  UriString,
} from "@1shotapi/ows-types";

import type { ECircleDomainId } from "../../types/enum/ECircleDomainId";

/** Iris `forward=true` fee row used to size `depositForBurnWithHook`. */
export interface IIrisForwardingFee {
  finalityThreshold: number;
  minimumFee: number;
  forwardFee: {
    low: string;
    med: string;
    high: string;
  };
}

export interface ICctpInFlightBurn {
  /** Source-chain burn id (EVM hex or Solana base58). */
  burnTxHash: TransactionHash;
  sourceDomain: ECircleDomainId;
  sourceChainId: OWSChainId;
  destChainId: OWSChainId;
  amountAtoms: bigint;
  /** Owner key for resume storage (EVM or Solana address). */
  address: string;
}

export interface IIrisCctpMessage {
  status?: string;
  /** Destination mint id when Forwarding completes (EVM or Solana). */
  forwardTxHash?: TransactionHash | null;
  message?: string;
  attestation?: string | null;
}

/**
 * Circle Iris HTTP client for CCTP V2 forwarding fees and burn-message polling.
 * No BridgeKit; persist in-flight burns for resume after reload.
 */
export interface ICircleRepository {
  getForwardingFees(
    irisBaseUrl: UriString,
    sourceDomain: ECircleDomainId,
    destDomain: ECircleDomainId,
  ): Promise<IIrisForwardingFee[]>;

  getMessageByBurnTx(
    irisBaseUrl: UriString,
    sourceDomain: ECircleDomainId,
    txHash: TransactionHash,
  ): Promise<IIrisCctpMessage | null>;

  saveInFlight(record: ICctpInFlightBurn): void;

  loadInFlight(address: string): ICctpInFlightBurn | null;

  clearInFlight(address: string): void;
}

export const ICircleRepositoryType = Symbol.for("ICircleRepository");
