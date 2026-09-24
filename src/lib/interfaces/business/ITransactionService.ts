import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
} from "@1shotapi/ows-types";
import type {
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../data/IOneshotRelayerRepository";
import type { IRelayerPayment } from "../../types/domain/RelayerPayment";
import type { IRelayerSendUiCallbacks } from "../../types/domain/RelayerSendUi";
import type { IWalletUpgradeStatus } from "../../types/domain/WalletUpgradeStatus";
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
  /** Chain where the fee ExactCalldata runs (may differ from the work chain). */
  paymentChainId: EVMChainId;
  paymentChainName: string;
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

export type ISendViaRelayerParams = {
  chainId: EVMChainId;
  work: ITransactionWork | ITransactionWork[];
  paymentToken: EVMAccountAddress;
  /** Fee atoms from the confirm UI quote; may be adjusted after estimate. */
  feeAtoms: TokenAmount;
  /**
   * Chain that pays the relayer fee. Defaults to `chainId`. When different,
   * fee runs on this chain and work on `chainId` (multichain 7710).
   */
  paymentChainId?: EVMChainId;
  authorizationList?: IRelayerAuthorizationEntry[];
};

/**
 * Orchestrates EIP-7702 upgrade, fee quotes, ExactCalldata delegations,
 * and public-relayer submit/poll (or raw RPC when `useRelayer` is false).
 */
export interface ITransactionService {
  needsWalletUpgrade(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean>;

  getWalletUpgradeStatus(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<IWalletUpgradeStatus>;

  signWalletUpgradeAuthorization(
    chainId: EVMChainId,
  ): Promise<IRelayerAuthorizationEntry>;

  /**
   * Resolve fee payment for work on `chainId` (local-first, Arc USDC fallback),
   * then unsigned estimate — single-chain or multichain when payment ≠ work.
   */
  quotePayment(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
    work: ITransactionWork | ITransactionWork[],
    preferredToken?: EVMAccountAddress,
  ): Promise<IPaymentQuote>;

  /** Unsigned fee quote for multi/single-chain EIP-7702 activation. */
  quoteActivation(
    owner: EVMAccountAddress,
    upgradeChainIds: readonly EVMChainId[],
    payment: IRelayerPayment,
  ): Promise<IPaymentQuote>;

  /**
   * Submit EIP-7702 activation (no-op work + USDC fee) and poll to confirm.
   */
  activateDelegations(
    args: {
      upgradeChainIds: readonly EVMChainId[];
      payment: IRelayerPayment;
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
      paymentChainId?: EVMChainId;
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
