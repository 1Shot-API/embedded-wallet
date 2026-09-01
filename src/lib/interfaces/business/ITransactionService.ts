import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";
import type {
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../data/IOneshotRelayerRepository";
import type { IRelayerSendUiCallbacks } from "../../types/domain/RelayerSendUi";
import type { TokenAmount } from "../../types/primitives";

export interface IPaymentTokenOption {
  address: EVMAccountAddress;
  symbol: string;
  name?: string;
  decimals: number;
  balance: TokenAmount;
}

export interface IPaymentQuote {
  tokens: IPaymentTokenOption[];
  selectedToken: EVMAccountAddress;
  feeAtoms: TokenAmount;
  feeFormatted: string;
  feeCollector: EVMAccountAddress;
  targetAddress: EVMAccountAddress;
  minFee: TokenAmount;
}

export interface ITransactionWork {
  to: EVMAccountAddress;
  data: HexString;
  value?: bigint;
}

export interface ISendViaRelayerParams {
  chainId: EVMChainId;
  work: ITransactionWork | ITransactionWork[];
  paymentToken: EVMAccountAddress;
  /** Fee atoms from the confirm UI quote; may be adjusted after estimate. */
  feeAtoms: TokenAmount;
  authorizationList?: IRelayerAuthorizationEntry[];
}

/**
 * Orchestrates EIP-7702 upgrade, fee quotes, ExactCalldata delegations,
 * and public-relayer submit/poll (or raw RPC when `useRelayer` is false).
 */
export interface ITransactionService {
  needsWalletUpgrade(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean>;

  signWalletUpgradeAuthorization(
    chainId: EVMChainId,
  ): Promise<IRelayerAuthorizationEntry>;

  /**
   * Prefer USDC with balance, then USDT, else first token with balance.
   * When `preferredToken` is set, use it if present in capabilities.
   * Returns a mock fee for confirm UI; submit uses `relayer_estimate7710Transaction`.
   */
  quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote>;

  /**
   * Branch on `SupportedChain.useRelayer`:
   * - false → prepare + sign + eth_sendRawTransaction
   * - true → two ExactCalldata delegations, estimate, send, poll
   */
  sendTransaction(
    chainId: EVMChainId,
    work: ITransactionWork,
    options?: {
      paymentToken?: EVMAccountAddress;
      feeAtoms?: TokenAmount;
      authorizationList?: IRelayerAuthorizationEntry[];
    } & IRelayerSendUiCallbacks,
  ): Promise<ISendTransactionResult>;
}

export const ITransactionServiceType = Symbol.for("ITransactionService");
