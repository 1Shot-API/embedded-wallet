import type {
  EVMAccountAddress,
  EVMChainId,
  SolanaAccountAddress,
  SolanaATAAddress,
  SolanaChainId,
  SolanaMintAddress,
} from "@1shotapi/ows-types";

import type { ICctpBridgeResult } from "../lib/interfaces/business/IBridgeService";
import type { ICctpInFlightBurn } from "../lib/interfaces/data/ICircleRepository";
import type { ECctpTransferSpeed } from "../lib/types/enum/ECctpTransferSpeed";

/** Params for opening the Solana → EVM CCTP bridge modal. */
export type ISolanaBridgeOpenRequest = {
  sourceChainId: SolanaChainId;
  ownerAddress: SolanaAccountAddress;
  /** USDC mint (catalog). */
  mint: SolanaMintAddress;
  /** Owner USDC ATA (must exist). */
  burnAta: SolanaATAAddress;
  balance?: bigint | null;
  amountAtoms?: bigint;
  destinationChainId?: EVMChainId;
  /** EVM mint recipient (defaults to session EVM in UI). */
  evmRecipient?: EVMAccountAddress;
  speed?: ECctpTransferSpeed;
  /** True when opened via host `bridge` RPC. */
  hostInitiated?: boolean;
  /** When set, skip the form and resume Iris polling. */
  resume?: ICctpInFlightBurn;
};

/** True when amount, destination, and speed are all set — skip setup and auto-quote. */
export function isSolanaBridgeParamsComplete(
  request: ISolanaBridgeOpenRequest,
): boolean {
  return (
    request.amountAtoms !== undefined &&
    request.amountAtoms > 0n &&
    request.destinationChainId !== undefined &&
    request.speed !== undefined
  );
}

export type ISolanaBridgeModalResult = ICctpBridgeResult;
