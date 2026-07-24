import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";
import type {
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../data/IOneshotRelayerRepository";

export interface IPaymentTokenOption {
  address: EVMAccountAddress;
  symbol: string;
  name?: string;
  decimals: number;
  balance: bigint;
}

export interface IPaymentQuote {
  tokens: IPaymentTokenOption[];
  selectedToken: EVMAccountAddress;
  feeAtoms: bigint;
  feeFormatted: string;
  feeCollector: EVMAccountAddress;
  targetAddress: EVMAccountAddress;
  minFee: bigint;
}

export interface ITransactionWork {
  to: EVMAccountAddress;
  data: HexString;
  value?: bigint;
}

/** Prefetched before confirm so post-confirm WebAuthn starts without network awaits. */
export interface IRelayerSendPrefetch {
  needsUpgrade: boolean;
  upgradeNonce?: number;
  upgradeContractAddress?: `0x${string}`;
}

export interface ISendViaRelayerParams {
  chainId: EVMChainId;
  work: ITransactionWork;
  paymentToken: EVMAccountAddress;
  /** Fee atoms from the confirm UI quote; may be adjusted after estimate. */
  feeAtoms: bigint;
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

  /**
   * Warm the viem account (passkey) and prefetch upgrade nonce while the
   * confirm UI is open — must run before the user clicks Confirm.
   */
  prefetchForRelayerSend(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IRelayerSendPrefetch>;

  signWalletUpgradeAuthorization(
    chainId: EVMChainId,
    prefetch?: IRelayerSendPrefetch,
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
      feeAtoms?: bigint;
      authorizationList?: IRelayerAuthorizationEntry[];
      prefetch?: IRelayerSendPrefetch;
    },
  ): Promise<ISendTransactionResult>;
}

export const ITransactionServiceType = Symbol.for("ITransactionService");
