import type {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
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
  burnTxHash: EVMTransactionHash;
  sourceDomain: ECircleDomainId;
  sourceChainId: EVMChainId;
  destChainId: EVMChainId;
  amountAtoms: bigint;
  address: EVMAccountAddress;
}

export interface IIrisCctpMessage {
  status?: string;
  forwardTxHash?: EVMTransactionHash | null;
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
    txHash: EVMTransactionHash,
  ): Promise<IIrisCctpMessage | null>;

  saveInFlight(record: ICctpInFlightBurn): void;

  loadInFlight(address: EVMAccountAddress): ICctpInFlightBurn | null;

  clearInFlight(address: EVMAccountAddress): void;
}

export const ICircleRepositoryType = Symbol.for("ICircleRepository");
