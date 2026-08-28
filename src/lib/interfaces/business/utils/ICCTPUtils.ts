import type {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  UriString,
} from "@1shotapi/ows-types";
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

export interface ICctpRoute {
  chainId: EVMChainId;
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
  mintRecipient: EVMAccountAddress;
  burnToken: EVMAccountAddress;
  maxFee: bigint;
  minFinalityThreshold: number;
}

export interface IBuildCctpRelayerWorkParams {
  allowance: bigint;
  totalBurn: bigint;
  usdcAddress: EVMAccountAddress;
  tokenMessenger: EVMAccountAddress;
  approveData: HexString;
  burnData: HexString;
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

  getRoute(chainId: EVMChainId): ICctpRoute | null;

  requireRoute(chainId: EVMChainId): ICctpRoute;

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

  shouldSkipUsdcApprove(allowance: bigint, totalBurn: bigint): boolean;

  buildRelayerWork(params: IBuildCctpRelayerWorkParams): ITransactionWork[];

  isValidDestination(source: SupportedChain, dest: SupportedChain): boolean;

  listDestinations(
    chains: readonly SupportedChain[],
    source: SupportedChain,
  ): SupportedChain[];
}

export const ICCTPUtilsType = Symbol.for("business.ICCTPUtils");
