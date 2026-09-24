import type { EVMChainId, EVMContractAddress } from "@1shotapi/ows-types";
import type { TokenAmount } from "../primitives";

/**
 * Relayer fee payment selected for one or more execution chains.
 * Fee ExactCalldata runs on `paymentChainId` (may differ from the work chain).
 */
export interface IRelayerPayment {
  paymentChainId: EVMChainId;
  /** ERC-20 payment token contract on `paymentChainId`. */
  paymentToken: EVMContractAddress;
  /** Human-readable payment-chain label for confirm UI. */
  paymentChainName: string;
  balance: TokenAmount;
  decimals: number;
  symbol: string;
}
