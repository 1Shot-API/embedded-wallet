import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { TokenAmount } from "../primitives";

/**
 * Relayer fee payment selected for one or more execution chains.
 * Fee ExactCalldata runs on `paymentChainId` (may differ from the work chain).
 */
export interface IRelayerPayment {
  paymentChainId: EVMChainId;
  paymentToken: EVMAccountAddress;
  /** Human-readable payment-chain label for confirm UI. */
  paymentChainName: string;
  balance: TokenAmount;
  decimals: number;
  symbol: string;
}
