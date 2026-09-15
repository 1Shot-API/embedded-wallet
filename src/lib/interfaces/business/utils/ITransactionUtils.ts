import type { LocalAccount } from "viem/accounts";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import type {
  IRelayerAuthorizationEntry,
  ISendTransactionResult,
} from "../../data/IOneshotRelayerRepository";
import type { IRelayerSendUiCallbacks } from "../../../types/domain/RelayerSendUi";
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
    /** Batch relayer vault auth into the coalesced sign ceremony via executeBatch. */
    prefetchRelayerVaultAssertion?: boolean;
  } & IRelayerSendUiCallbacks): Promise<ISendTransactionResult>;

  /**
   * EIP-1559 `maxFeePerGas` (fallback `getGasPrice`) × 21000 for a plain
   * native transfer, plus {@link NATIVE_FEE_HEADROOM_BPS} headroom so Max /
   * balance checks survive fee movement before inclusion.
   */
  estimateNativeTransferFee(chainId: EVMChainId): Promise<{
    gasPrice: bigint;
    maxPriorityFeePerGas: bigint;
    feeAtoms: bigint;
  }>;

  /**
   * Fresh fee quote + clamp `value` to `balance − bufferedFee`, returning
   * gas params to pin on the signed tx (same quote Max reserved against).
   */
  planNativeTransfer(
    chainId: EVMChainId,
    value: bigint,
  ): Promise<{
    value: bigint;
    gas: bigint;
    maxFeePerGas: bigint;
    maxPriorityFeePerGas: bigint;
  }>;
}

/** Fixed gas units for a simple EVM native value transfer. */
export const NATIVE_TRANSFER_GAS = 21000n;

/**
 * Extra reserve on top of viem's fee estimate (basis points).
 * Viem already multiplies base fee by ~1.2; wallets still leave additional
 * headroom because base fee can rise ~12.5% per block while a tx sits in the
 * mempool — exact 100% drains are not reliable under EIP-1559.
 */
export const NATIVE_FEE_HEADROOM_BPS = 2500n; // 25%

const BPS_DENOMINATOR = 10000n;

/** Apply {@link NATIVE_FEE_HEADROOM_BPS} to a per-gas price. */
export function withNativeFeeHeadroom(gasPrice: bigint): bigint {
  return gasPrice + (gasPrice * NATIVE_FEE_HEADROOM_BPS) / BPS_DENOMINATOR;
}

/** Largest sendable amount that still leaves room for {@link feeAtoms}. */
export function maxNativeSendable(balance: bigint, feeAtoms: bigint): bigint {
  if (balance <= feeAtoms) return 0n;
  return balance - feeAtoms;
}

export const ITransactionUtilsType = Symbol.for("business.ITransactionUtils");
