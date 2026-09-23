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
import type { IActivationPayment } from "./utils/ITransactionUtils";

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
   * Quotes via unsigned `relayer_estimate7710Transaction` (placeholder
   * signatures) so confirm UI shows an accurate fee before passkey sign.
   */
  quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    work: ITransactionWork | ITransactionWork[],
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote>;

  /**
   * Resolve USDC payment for EIP-7702 offline-permission activation among
   * candidate chains (requested ∪ Arc). Null when none hold USDC.
   */
  resolveActivationPayment(
    owner: EVMAccountAddress,
    candidateChainIds: readonly EVMChainId[],
  ): Promise<IActivationPayment | null>;

  /** Unsigned USDC fee quote for multi/single-chain EIP-7702 activation. */
  quoteActivation(
    owner: EVMAccountAddress,
    upgradeChainIds: readonly EVMChainId[],
    payment: IActivationPayment,
  ): Promise<IPaymentQuote>;

  /**
   * Submit EIP-7702 activation (no-op work + USDC fee) and poll to confirm.
   */
  activateDelegations(
    args: {
      upgradeChainIds: readonly EVMChainId[];
      payment: IActivationPayment;
      feeAtoms: TokenAmount;
    } & IRelayerSendUiCallbacks,
  ): Promise<ISendTransactionResult[]>;

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

  /**
   * Plain native value transfer via eth_sendRawTransaction — never the
   * public relayer, even when the chain has `useRelayer: true`.
   */
  sendNativeTransfer(
    chainId: EVMChainId,
    to: EVMAccountAddress,
    value: bigint,
  ): Promise<ISendTransactionResult>;

  /** Fee preview for native Send Max / summary UI. */
  estimateNativeTransferFee(chainId: EVMChainId): Promise<{
    gasPrice: bigint;
    maxPriorityFeePerGas: bigint;
    feeAtoms: bigint;
  }>;
}

export const ITransactionServiceType = Symbol.for("ITransactionService");
