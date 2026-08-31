import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
} from "@1shotapi/ows-types";
import type { ICctpInFlightBurn } from "../lib/interfaces/data/ICircleRepository";
import type { ICctpBridgeResult } from "../lib/interfaces/business/IBridgeService";
import type { ECctpTransferSpeed } from "../lib/types/enum/ECctpTransferSpeed";

/** Params for opening the shared CCTP bridge modal (in-wallet + host `bridge`). */
export type ICctpBridgeOpenRequest = {
  sourceChainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  balance?: bigint | null;
  amountAtoms?: bigint;
  destinationChainId?: EVMChainId;
  /** When set with amount + dest, skip setup and auto-quote. */
  speed?: ECctpTransferSpeed;
  /** Optional; must be native CCTP USDC on the source chain when provided. */
  tokenAddress?: EVMContractAddress;
  /** True when opened via host `bridge` RPC (Cancel on confirm; closes via display.hide). */
  hostInitiated?: boolean;
  /** When set, skip the form and resume Iris polling. */
  resume?: ICctpInFlightBurn;
};

/** True when amount, destination, and speed are all set — skip setup and auto-quote. */
export function isCctpBridgeParamsComplete(
  request: ICctpBridgeOpenRequest,
): boolean {
  return (
    request.amountAtoms !== undefined &&
    request.amountAtoms > 0n &&
    request.destinationChainId !== undefined &&
    request.speed !== undefined
  );
}

export type ICctpBridgeModalResult = ICctpBridgeResult;
