import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
  OWSChainId,
  SolanaAccountAddress,
  SolanaChainId,
  UriString,
} from "@1shotapi/ows-types";
import type {
  Address,
  Instruction,
  TransactionSigner,
} from "@solana/kit";

import type { SupportedChain } from "../../../types/domain/SupportedChain";
import type { ECctpTransferSpeed } from "../../../types/enum/ECctpTransferSpeed";
import type { EChainNetworkType } from "../../../types/enum/EChainNetworkType";
import type { ECircleDomainId } from "../../../types/enum/ECircleDomainId";
import type { IIrisForwardingFee } from "../../data/ICircleRepository";
import type { ITransactionWork } from "../ITransactionService";

export interface ICctpContracts {
  tokenMessengerV2: EVMAccountAddress;
  messageTransmitterV2: EVMAccountAddress;
}

/** Solana CCTP V2 program ids (same on mainnet + Devnet). */
export interface ISolanaCctpPrograms {
  tokenMessengerMinterV2: string;
  messageTransmitterV2: string;
}

export interface ICctpRoute {
  chainId: OWSChainId;
  domain: ECircleDomainId;
  networkType: EChainNetworkType;
  irisBaseUrl: UriString;
}

export interface ICctpBurnFees {
  forwardFee: bigint;
  protocolFee: bigint;
  maxFee: bigint;
  totalBurn: bigint;
}

export interface IEncodeDepositForBurnWithHookParams {
  totalBurn: bigint;
  destDomain: ECircleDomainId;
  /**
   * Destination mint recipient as 32-byte hex.
   * EVM: left-padded address. Solana dest: ATA pubkey bytes as hex.
   */
  mintRecipientBytes32: HexString;
  burnToken: EVMContractAddress;
  maxFee: bigint;
  minFinalityThreshold: number;
}

export interface IBuildCctpRelayerWorkParams {
  allowance: bigint;
  totalBurn: bigint;
  usdcAddress: EVMContractAddress;
  tokenMessenger: EVMAccountAddress;
  approveData: HexString;
  burnData: HexString;
}

/** Params for Solana TokenMessengerMinterV2 `deposit_for_burn_with_hook`. */
export interface IBuildSolanaDepositForBurnWithHookParams {
  owner: TransactionSigner;
  ownerAddress: Address;
  usdcMint: Address;
  /** Owner's USDC ATA (must exist). */
  burnTokenAccount: Address;
  destinationDomain: ECircleDomainId;
  /** 32-byte mint recipient (padded EVM address). */
  mintRecipient: Uint8Array;
  totalBurn: bigint;
  maxFee: bigint;
  minFinalityThreshold: number;
}

export interface ISolanaDepositForBurnWithHookBuilt {
  instruction: Instruction;
  /** Ephemeral MessageSent account — must co-sign the transaction. */
  messageSentSigner: TransactionSigner & { address: Address };
}

/**
 * CCTP V2 helpers: routes, Iris fee math, contract addresses, burn calldata,
 * and destination filtering. Stateless — safe as a singleton.
 */
export interface ICCTPUtils {
  readonly irisApiMainnet: string;
  readonly irisApiTestnet: string;
  readonly fastFinalityThreshold: number;
  readonly slowFinalityThreshold: number;
  /** 32-byte `cctp-forward` hook (Circle Forwarding Service). */
  readonly forwardHookData: HexString;
  /** Raw hook bytes for Solana `deposit_for_burn_with_hook`. */
  readonly forwardHookDataBytes: Uint8Array;

  getRoute(chainId: OWSChainId): ICctpRoute | null;

  requireRoute(chainId: OWSChainId): ICctpRoute;

  getSolanaPrograms(): ISolanaCctpPrograms;

  finalityThresholdForSpeed(speed: ECctpTransferSpeed): number;

  irisBaseUrlForNetwork(networkType: EChainNetworkType): UriString;

  getContracts(
    domain: ECircleDomainId,
    networkType: EChainNetworkType,
  ): ICctpContracts;

  computeBurnFees(
    amountAtoms: bigint,
    fee: IIrisForwardingFee,
  ): ICctpBurnFees;

  pickFeeForThreshold(
    fees: readonly IIrisForwardingFee[],
    finalityThreshold: number,
  ): IIrisForwardingFee;

  encodeUsdcApprove(spender: EVMAccountAddress, amount: bigint): HexString;

  encodeDepositForBurnWithHook(
    params: IEncodeDepositForBurnWithHookParams,
  ): HexString;

  /** Build Solana CCTP V2 `deposit_for_burn_with_hook` (Forwarding Service). */
  buildSolanaDepositForBurnWithHook(
    params: IBuildSolanaDepositForBurnWithHookParams,
  ): Promise<ISolanaDepositForBurnWithHookBuilt>;

  shouldSkipUsdcApprove(allowance: bigint, totalBurn: bigint): boolean;

  buildRelayerWork(params: IBuildCctpRelayerWorkParams): ITransactionWork[];

  isValidDestination(source: SupportedChain, dest: SupportedChain): boolean;

  listDestinations(
    chains: readonly SupportedChain[],
    source: SupportedChain,
  ): SupportedChain[];

  isSolanaRoute(chainId: OWSChainId): boolean;
}

export const ICCTPUtilsType = Symbol.for("business.ICCTPUtils");

export type { SolanaAccountAddress, SolanaChainId, EVMChainId };
