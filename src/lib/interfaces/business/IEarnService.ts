import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  EVMTransactionHash,
} from "@1shotapi/ows-types";
import type { KnownAsset } from "../../types/domain/KnownAsset";
import type { IPaymentQuote, ITransactionWork } from "./ITransactionService";

export type IEarnPosition = {
  chainId: EVMChainId;
  vaultAddress: EVMContractAddress;
  vaultName: string;
  /** Vault share balance (raw). */
  shares: bigint;
  /** Underlying USDC value of shares (raw atoms). */
  assets: bigint;
  /** Current APY as a decimal (e.g. 0.042 = 4.2%), when known. */
  currentApy: number | null;
};

export type IEarnQuoteParams = {
  chainId: EVMChainId;
  owner: EVMAccountAddress;
  /** USDC atoms to deposit or withdraw. */
  amountAtoms: bigint;
};

export type IEarnQuote = {
  chainId: EVMChainId;
  owner: EVMAccountAddress;
  amountAtoms: bigint;
  usdc: KnownAsset;
  vaultAddress: EVMContractAddress;
  vaultName: string;
  /** Expected shares to receive (deposit) or redeem (withdraw). */
  sharesAtoms: bigint;
  currentApy: number | null;
  paymentQuote: IPaymentQuote;
  relayerWork: ITransactionWork[];
};

export type IEarnPayment = {
  paymentToken: EVMContractAddress;
  feeAtoms: import("../../types/primitives").TokenAmount;
  paymentChainId?: EVMChainId;
};

export type IEarnResult = {
  transactionHash: EVMTransactionHash;
};

/**
 * Arc USDC Earn — Morpho ERC-4626 vault deposit/withdraw via the EIP-7710
 * public relayer (same gasless pattern as CCTP Bridge).
 */
export interface IEarnService {
  /** True when the catalog pins an Earn vault for this USDC asset. */
  isEarnSupported(chainId: EVMChainId, usdcAddress: EVMContractAddress): Promise<boolean>;

  getPosition(
    chainId: EVMChainId,
    owner: EVMAccountAddress,
  ): Promise<IEarnPosition>;

  quoteDeposit(params: IEarnQuoteParams): Promise<IEarnQuote>;

  quoteWithdraw(params: IEarnQuoteParams): Promise<IEarnQuote>;

  deposit(quote: IEarnQuote, payment: IEarnPayment): Promise<IEarnResult>;

  withdraw(quote: IEarnQuote, payment: IEarnPayment): Promise<IEarnResult>;
}

export const IEarnServiceType = Symbol.for("IEarnService");
