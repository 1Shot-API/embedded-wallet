import {
  EVMAccountAddress,
  HexString,
  UriString,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
  type HexString as HexStringType,
} from "@1shotapi/ows-types";
import {
  encodeFunctionData,
  erc20Abi,
  pad,
  padHex,
  stringToHex,
  type Hex,
} from "viem";
import type { SupportedChain } from "../../../types/domain/SupportedChain";
import { ECctpTransferSpeed } from "../../../types/enum/ECctpTransferSpeed";
import { EChain } from "../../../types/enum/EChain";
import { EChainNetworkType } from "../../../types/enum/EChainNetworkType";
import { ECircleDomainId } from "../../../types/enum/ECircleDomainId";
import type { IIrisForwardingFee } from "../../../interfaces/data/ICircleRepository";
import type { ITransactionWork } from "../../../interfaces/business/ITransactionService";
import type {
  IBuildCctpRelayerWorkParams,
  ICctpBurnFees,
  ICctpContracts,
  ICctpRoute,
  ICCTPUtils,
  IEncodeDepositForBurnWithHookParams,
} from "../../../interfaces/business/utils/ICCTPUtils";

const IRIS_API_MAINNET = UriString("https://iris-api.circle.com");
const IRIS_API_TESTNET = UriString("https://iris-api-sandbox.circle.com");
const CCTP_FAST_FINALITY_THRESHOLD = 1000;
const CCTP_SLOW_FINALITY_THRESHOLD = 2000;

// The deployment addresses for the CCTP V2 contracts are identical across all networks we care about. There are some exceptions but they are for chains we don't support.
const MAINNET_TOKEN_MESSENGER = EVMAccountAddress(
  "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
);
const MAINNET_MESSAGE_TRANSMITTER = EVMAccountAddress(
  "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
);
const TESTNET_TOKEN_MESSENGER = EVMAccountAddress(
  "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
);
const TESTNET_MESSAGE_TRANSMITTER = EVMAccountAddress(
  "0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275",
);

/** TokenMessengerV2 fragment used for gasless CCTP burns. */
const tokenMessengerV2Abi = [
  {
    type: "function",
    name: "depositForBurnWithHook",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
      { name: "hookData", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

const SUPPORTED_DOMAINS = new Set<ECircleDomainId>([
  ECircleDomainId.Ethereum,
  ECircleDomainId.Optimism,
  ECircleDomainId.Arbitrum,
  ECircleDomainId.Base,
  ECircleDomainId.Polygon,
  ECircleDomainId.Unichain,
  ECircleDomainId.Linea,
  ECircleDomainId.Sonic,
  ECircleDomainId.Monad,
  ECircleDomainId.Arc,
]);

const FORWARD_HOOK_DATA = HexString(
  stringToHex("cctp-forward", { size: 32 }) as Hex,
);

function route(
  chainId: EVMChainIdType,
  domain: ECircleDomainId,
  networkType: EChainNetworkType,
): ICctpRoute {
  return {
    chainId,
    domain,
    networkType,
    irisBaseUrl:
      networkType === EChainNetworkType.Mainnet
        ? IRIS_API_MAINNET
        : IRIS_API_TESTNET,
  };
}

const ROUTES: readonly ICctpRoute[] = [
  route(EChain.ArcTestnet, ECircleDomainId.Arc, EChainNetworkType.Testnet),
  route(EChain.Sepolia, ECircleDomainId.Ethereum, EChainNetworkType.Testnet),
  route(EChain.BaseSepolia, ECircleDomainId.Base, EChainNetworkType.Testnet),
  route(EChain.Ethereum, ECircleDomainId.Ethereum, EChainNetworkType.Mainnet),
  route(EChain.Optimism, ECircleDomainId.Optimism, EChainNetworkType.Mainnet),
  route(EChain.Arbitrum, ECircleDomainId.Arbitrum, EChainNetworkType.Mainnet),
  route(EChain.Base, ECircleDomainId.Base, EChainNetworkType.Mainnet),
  route(EChain.Polygon, ECircleDomainId.Polygon, EChainNetworkType.Mainnet),
  route(EChain.Linea, ECircleDomainId.Linea, EChainNetworkType.Mainnet),
  route(EChain.Monad, ECircleDomainId.Monad, EChainNetworkType.Mainnet),
  route(EChain.Sonic, ECircleDomainId.Sonic, EChainNetworkType.Mainnet),
  route(EChain.Unichain, ECircleDomainId.Unichain, EChainNetworkType.Mainnet),
];

const BY_CHAIN = new Map(
  ROUTES.map((entry) => [String(entry.chainId).toLowerCase(), entry]),
);

/**
 * CCTP V2 routes, Iris fee math, contract addresses, burn encoding, and
 * destination filtering. Stateless — construct once and inject.
 */
export class CCTPUtils implements ICCTPUtils {
  readonly irisApiMainnet = IRIS_API_MAINNET;
  readonly irisApiTestnet = IRIS_API_TESTNET;
  readonly fastFinalityThreshold = CCTP_FAST_FINALITY_THRESHOLD;
  readonly slowFinalityThreshold = CCTP_SLOW_FINALITY_THRESHOLD;
  readonly forwardHookData = FORWARD_HOOK_DATA;

  getRoute(chainId: EVMChainIdType): ICctpRoute | null {
    return BY_CHAIN.get(String(chainId).toLowerCase()) ?? null;
  }

  requireRoute(chainId: EVMChainIdType): ICctpRoute {
    const found = this.getRoute(chainId);
    if (!found) {
      throw new Error(`Chain ${chainId} is not a CCTP V2 source`);
    }
    return found;
  }

  finalityThresholdForSpeed(speed: ECctpTransferSpeed): number {
    return speed === ECctpTransferSpeed.Fast
      ? CCTP_FAST_FINALITY_THRESHOLD
      : CCTP_SLOW_FINALITY_THRESHOLD;
  }

  irisBaseUrlForNetwork(networkType: EChainNetworkType): UriString {
    return networkType === EChainNetworkType.Mainnet
      ? IRIS_API_MAINNET
      : IRIS_API_TESTNET;
  }

  getContracts(
    domain: ECircleDomainId,
    networkType: EChainNetworkType,
  ): ICctpContracts {
    if (!SUPPORTED_DOMAINS.has(domain)) {
      throw new Error(`No CCTP V2 contracts for Circle domain ${domain}`);
    }
    if (networkType === EChainNetworkType.Mainnet) {
      return {
        tokenMessengerV2: MAINNET_TOKEN_MESSENGER,
        messageTransmitterV2: MAINNET_MESSAGE_TRANSMITTER,
      };
    }
    return {
      tokenMessengerV2: TESTNET_TOKEN_MESSENGER,
      messageTransmitterV2: TESTNET_MESSAGE_TRANSMITTER,
    };
  }

  /**
   * Circle CCTP forwarding fee math (Ethereum→Arc quickstart).
   * `minimumFee` is a human rate; convert via `round(minimumFee * 100) / 1e6`.
   */
  computeBurnFees(
    amountAtoms: bigint,
    fee: IIrisForwardingFee,
  ): ICctpBurnFees {
    const forwardFee = BigInt(fee.forwardFee.med);
    const protocolFee =
      (amountAtoms * BigInt(Math.round(fee.minimumFee * 100))) / 1_000_000n;
    const maxFee = forwardFee + protocolFee;
    return {
      forwardFee,
      protocolFee,
      maxFee,
      totalBurn: amountAtoms + maxFee,
    };
  }

  pickFeeForThreshold(
    fees: readonly IIrisForwardingFee[],
    finalityThreshold: number,
  ): IIrisForwardingFee {
    const match = fees.find(
      (row) => row.finalityThreshold === finalityThreshold,
    );
    if (!match) {
      throw new Error(
        `No Iris forwarding fee for finalityThreshold ${finalityThreshold}`,
      );
    }
    return match;
  }

  encodeUsdcApprove(
    spender: EVMAccountAddressType,
    amount: bigint,
  ): HexStringType {
    return HexString(
      encodeFunctionData({
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, amount],
      }) as Hex,
    );
  }

  encodeDepositForBurnWithHook(
    params: IEncodeDepositForBurnWithHookParams,
  ): HexStringType {
    return HexString(
      encodeFunctionData({
        abi: tokenMessengerV2Abi,
        functionName: "depositForBurnWithHook",
        args: [
          params.totalBurn,
          params.destDomain,
          pad(params.mintRecipient, { size: 32 }),
          params.burnToken,
          padHex("0x", { size: 32 }),
          params.maxFee,
          params.minFinalityThreshold,
          FORWARD_HOOK_DATA,
        ],
      }) as Hex,
    );
  }

  shouldSkipUsdcApprove(allowance: bigint, totalBurn: bigint): boolean {
    return allowance >= totalBurn;
  }

  /** Approve (if needed) + `depositForBurnWithHook` ExactCalldata work items. */
  buildRelayerWork(params: IBuildCctpRelayerWorkParams): ITransactionWork[] {
    const burn: ITransactionWork = {
      to: params.tokenMessenger,
      data: params.burnData,
      value: 0n,
    };
    if (this.shouldSkipUsdcApprove(params.allowance, params.totalBurn)) {
      return [burn];
    }
    return [
      {
        to: params.usdcAddress,
        data: params.approveData,
        value: 0n,
      },
      burn,
    ];
  }

  isValidDestination(source: SupportedChain, dest: SupportedChain): boolean {
    if (!dest.cctpBridgeDestination) {
      return false;
    }
    if (dest.networkType !== source.networkType) {
      return false;
    }
    return (
      String(dest.chainId).toLowerCase() !==
      String(source.chainId).toLowerCase()
    );
  }

  listDestinations(
    chains: readonly SupportedChain[],
    source: SupportedChain,
  ): SupportedChain[] {
    return chains.filter((chain) => this.isValidDestination(source, chain));
  }
}

/** Exported for encode tests that decode against the same ABI fragment. */
export { tokenMessengerV2Abi };
