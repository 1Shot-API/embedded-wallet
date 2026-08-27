import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type { ICctpInFlightBurn } from "../lib/interfaces/data/ICircleRepository";
import type { ICctpBridgeResult } from "../lib/interfaces/business/IBridgeService";

/** Params for opening the shared CCTP bridge modal (in-wallet + host `bridge`). */
export type ICctpBridgeOpenRequest = {
  sourceChainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  balance?: bigint | null;
  amountAtoms?: bigint;
  destinationChainId?: EVMChainId;
  /** When set, skip the form and resume Iris polling. */
  resume?: ICctpInFlightBurn;
};

export type ICctpBridgeModalResult = ICctpBridgeResult;
