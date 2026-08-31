import type { LocalAccount } from "viem/accounts";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type {
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../../data/IOneshotRelayerRepository";
import type { TokenAmount } from "../../../types/primitives";
import type {
  IPaymentQuote,
  ITransactionWork,
} from "../ITransactionService";

/**
 * Shared send / EIP-7702 / ExactCalldata delegation plumbing for
 * {@link ITransactionService} and {@link IDelegationService}.
 *
 * Distinct from presentation {@link import("../../utils/ITransactionUtils").ITransactionUtils}
 * (decode ERC-20, format amounts, host domain labels).
 */
export interface ITransactionUtils {
  needsWalletUpgrade(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean>;

  signWalletUpgradeAuthorization(
    chainId: EVMChainId,
  ): Promise<IRelayerAuthorizationEntry>;

  getViemAccount(addressOverride?: EVMAccountAddress): Promise<LocalAccount>;

  /**
   * Prefer USDC with balance, then USDT, else first token with balance.
   * Mock fee for confirm UI; submit uses `relayer_estimate7710Transaction`.
   */
  quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote>;

  /**
   * Public-relayer ExactCalldata fee + work path: optional EIP-7702 upgrade,
   * estimate, send, poll. `work` may be one item (Send) or several
   * (e.g. USDC approve + CCTP burn) — still one fee and one passkey ceremony.
   */
  sendViaRelayer(args: {
    chainId: EVMChainId;
    work: ITransactionWork | ITransactionWork[];
    paymentToken: EVMAccountAddress;
    feeAtoms: TokenAmount;
    authorizationList?: IRelayerAuthorizationEntry[];
    relayerUrl: string;
  }): Promise<ISendTransactionResult>;
}

export const ITransactionUtilsType = Symbol.for("business.ITransactionUtils");
