import type {
  EVMChainId,
  EVMContractAddress,
  HexString,
} from "@1shotapi/ows-types";
import type { Address, Hex } from "viem";

/** Packed LiFiSwapEnforcer terms fields (pre-encode). */
export type ILiFiSwapTerms = {
  lifiDiamond: Address;
  inputToken: Address;
  outputAssetId: Hex;
  outputRecipient: Hex;
  destinationChainId: bigint;
  quoteSigner: Address;
  periodAmount: bigint;
  periodDuration: bigint;
  startDate: bigint;
  slippageBps: bigint;
};

/**
 * LiFiSwapEnforcer helpers: deployments and 284-byte terms encoding.
 * Stateless — safe as a singleton.
 */
export interface ILiFiUtils {
  /** `LiFiSwapQuoteLib.TERMS_LENGTH`. */
  readonly termsLength: number;
  /** Default max slippage in basis points (0.5%). Must be < 10000. */
  readonly defaultSlippageBps: number;

  resolveSwapEnforcer(chainId: EVMChainId | string): EVMContractAddress | null;

  /**
   * Pack LiFiSwapEnforcer terms (284 bytes).
   * Order must match `LiFiSwapQuoteLib.encodeTerms`.
   */
  encodeTerms(terms: ILiFiSwapTerms): HexString;
}

export const ILiFiUtilsType = Symbol.for("business.ILiFiUtils");
