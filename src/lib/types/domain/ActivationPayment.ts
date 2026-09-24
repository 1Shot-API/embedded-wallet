import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import type { TokenAmount } from "../primitives";

/** Payment chain + USDC selected for offline-permission EIP-7702 activation. */
export interface IActivationPayment {
  paymentChainId: EVMChainId;
  paymentToken: EVMAccountAddress;
  /** Human-readable payment-chain label for the confirm modal. */
  paymentChainName: string;
  usdcBalance: TokenAmount;
  usdcDecimals: number;
  usdcSymbol: string;
}
