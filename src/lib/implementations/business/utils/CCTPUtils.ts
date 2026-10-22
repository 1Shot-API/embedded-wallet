import {
  ChainUtils,
  EVMAccountAddress,
  HexString,
  UriString,
  type EVMAccountAddress as EVMAccountAddressType,
  type HexString as HexStringType,
  type OWSChainId,
} from "@1shotapi/ows-types";
import {
  AccountRole,
  address,
  generateKeyPairSigner,
  getAddressEncoder,
  getProgramDerivedAddress,
  getUtf8Encoder,
  type Instruction,
} from "@solana/kit";
import { TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import {
  encodeFunctionData,
  erc20Abi,
  padHex,
  stringToHex,
  type Hex,
} from "viem";

import type { ITransactionWork } from "../../../interfaces/business/ITransactionService";
import type {
  IBuildCctpRelayerWorkParams,
  IBuildSolanaDepositForBurnWithHookParams,
  ICctpBurnFees,
  ICctpContracts,
  ICctpRoute,
  ICCTPUtils,
  IEncodeDepositForBurnWithHookParams,
  ISolanaCctpPrograms,
  ISolanaDepositForBurnWithHookBuilt,
} from "../../../interfaces/business/utils/ICCTPUtils";
import type { IIrisForwardingFee } from "../../../interfaces/data/ICircleRepository";
import type { SupportedChain } from "../../../types/domain/SupportedChain";
import { ECctpTransferSpeed } from "../../../types/enum/ECctpTransferSpeed";
import { EChain } from "../../../types/enum/EChain";
import { EChainNetworkType } from "../../../types/enum/EChainNetworkType";
import { ECircleDomainId } from "../../../types/enum/ECircleDomainId";

/** Anchor discriminator for `deposit_for_burn_with_hook`. */
const DEPOSIT_FOR_BURN_WITH_HOOK_DISCRIMINATOR = new Uint8Array([
  111, 245, 62, 131, 204, 108, 223, 155,
]);

const SYSTEM_PROGRAM = address("11111111111111111111111111111111");

const IRIS_API_MAINNET = UriString("https://iris-api.circle.com");
const IRIS_API_TESTNET = UriString("https://iris-api-sandbox.circle.com");
const CCTP_FAST_FINALITY_THRESHOLD = 1000;
const CCTP_SLOW_FINALITY_THRESHOLD = 2000;

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

/** Same program ids on Solana mainnet + Devnet (Circle CCTP V2). */
const SOLANA_TOKEN_MESSENGER_MINTER =
  "CCTPV2vPZJS2u2BBsUoscuikbYjnpFmbFsvVuJdgUMQe";
const SOLANA_MESSAGE_TRANSMITTER =
  "CCTPV2Sm4AdWt5296sk4P66VBZ7bEhcARwFaaS9YPbeC";

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

/** Domains with EVM TokenMessengerV2 deployments we encode against. */
const EVM_SUPPORTED_DOMAINS = new Set<ECircleDomainId>([
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

const FORWARD_HOOK_BYTES = (() => {
  const hex = String(FORWARD_HOOK_DATA).replace(/^0x/i, "");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
})();

function route(
  chainId: OWSChainId,
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
  route(EChain.Arc, ECircleDomainId.Arc, EChainNetworkType.Mainnet),
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
  route(EChain.Solana, ECircleDomainId.Solana, EChainNetworkType.Mainnet),
  route(
    EChain.SolanaDevnet,
    ECircleDomainId.Solana,
    EChainNetworkType.Testnet,
  ),
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
  readonly forwardHookDataBytes = FORWARD_HOOK_BYTES;

  getRoute(chainId: OWSChainId): ICctpRoute | null {
    return BY_CHAIN.get(String(chainId).toLowerCase()) ?? null;
  }

  requireRoute(chainId: OWSChainId): ICctpRoute {
    const found = this.getRoute(chainId);
    if (!found) {
      throw new Error(`Chain ${chainId} is not a CCTP V2 route`);
    }
    return found;
  }

  getSolanaPrograms(): ISolanaCctpPrograms {
    return {
      tokenMessengerMinterV2: SOLANA_TOKEN_MESSENGER_MINTER,
      messageTransmitterV2: SOLANA_MESSAGE_TRANSMITTER,
    };
  }

  isSolanaRoute(chainId: OWSChainId): boolean {
    return ChainUtils.isSolanaChainId(chainId);
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
    if (!EVM_SUPPORTED_DOMAINS.has(domain)) {
      throw new Error(`No EVM CCTP V2 contracts for Circle domain ${domain}`);
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
          params.mintRecipientBytes32 as Hex,
          params.burnToken,
          padHex("0x", { size: 32 }),
          params.maxFee,
          params.minFinalityThreshold,
          FORWARD_HOOK_DATA,
        ],
      }) as Hex,
    );
  }

  /**
   * Build Circle CCTP V2 `deposit_for_burn_with_hook` (Forwarding Service)
   * using Kit accounts + Anchor-style instruction data.
   */
  async buildSolanaDepositForBurnWithHook(
    params: IBuildSolanaDepositForBurnWithHookParams,
  ): Promise<ISolanaDepositForBurnWithHookBuilt> {
    const programs = this.getSolanaPrograms();
    const tokenMessenger = address(programs.tokenMessengerMinterV2);
    const messageTransmitter = address(programs.messageTransmitterV2);
    const addressEncoder = getAddressEncoder();
    const utf8 = getUtf8Encoder();

    const [senderAuthorityPda] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [utf8.encode("sender_authority")],
    });
    const [denylistPda] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [
        utf8.encode("denylist_account"),
        addressEncoder.encode(params.ownerAddress),
      ],
    });
    const [messageTransmitterState] = await getProgramDerivedAddress({
      programAddress: messageTransmitter,
      seeds: [utf8.encode("message_transmitter")],
    });
    const [tokenMessengerState] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [utf8.encode("token_messenger")],
    });
    const [remoteTokenMessenger] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [
        utf8.encode("remote_token_messenger"),
        utf8.encode(String(params.destinationDomain)),
      ],
    });
    const [tokenMinter] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [utf8.encode("token_minter")],
    });
    const [localToken] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [
        utf8.encode("local_token"),
        addressEncoder.encode(params.usdcMint),
      ],
    });
    const [eventAuthority] = await getProgramDerivedAddress({
      programAddress: tokenMessenger,
      seeds: [utf8.encode("__event_authority")],
    });
    const [messageTransmitterEventAuthority] = await getProgramDerivedAddress({
      programAddress: messageTransmitter,
      seeds: [utf8.encode("__event_authority")],
    });

    const messageSentSigner = await generateKeyPairSigner();
    const hook = this.forwardHookDataBytes;

    const amountBuffer = new Uint8Array(8);
    new DataView(amountBuffer.buffer).setBigUint64(0, params.totalBurn, true);
    const domainBuffer = new Uint8Array(4);
    new DataView(domainBuffer.buffer).setUint32(
      0,
      params.destinationDomain,
      true,
    );
    const maxFeeBuffer = new Uint8Array(8);
    new DataView(maxFeeBuffer.buffer).setBigUint64(0, params.maxFee, true);
    const finalityBuffer = new Uint8Array(4);
    new DataView(finalityBuffer.buffer).setUint32(
      0,
      params.minFinalityThreshold,
      true,
    );
    const hookLengthBuffer = new Uint8Array(4);
    new DataView(hookLengthBuffer.buffer).setUint32(0, hook.length, true);

    const data = concatBytes([
      DEPOSIT_FOR_BURN_WITH_HOOK_DISCRIMINATOR,
      amountBuffer,
      domainBuffer,
      params.mintRecipient,
      new Uint8Array(32),
      maxFeeBuffer,
      finalityBuffer,
      hookLengthBuffer,
      hook,
    ]);

    const instruction = {
      programAddress: tokenMessenger,
      accounts: [
        {
          address: params.ownerAddress,
          role: AccountRole.WRITABLE_SIGNER,
          signer: params.owner,
        },
        {
          address: params.ownerAddress,
          role: AccountRole.WRITABLE_SIGNER,
          signer: params.owner,
        },
        { address: senderAuthorityPda, role: AccountRole.READONLY },
        { address: params.burnTokenAccount, role: AccountRole.WRITABLE },
        { address: denylistPda, role: AccountRole.READONLY },
        { address: messageTransmitterState, role: AccountRole.WRITABLE },
        { address: tokenMessengerState, role: AccountRole.READONLY },
        { address: remoteTokenMessenger, role: AccountRole.READONLY },
        { address: tokenMinter, role: AccountRole.READONLY },
        { address: localToken, role: AccountRole.WRITABLE },
        { address: params.usdcMint, role: AccountRole.WRITABLE },
        {
          address: messageSentSigner.address,
          role: AccountRole.WRITABLE_SIGNER,
          signer: messageSentSigner,
        },
        { address: messageTransmitter, role: AccountRole.READONLY },
        { address: tokenMessenger, role: AccountRole.READONLY },
        { address: TOKEN_PROGRAM_ADDRESS, role: AccountRole.READONLY },
        { address: SYSTEM_PROGRAM, role: AccountRole.READONLY },
        { address: eventAuthority, role: AccountRole.READONLY },
        { address: tokenMessenger, role: AccountRole.READONLY },
        {
          address: messageTransmitterEventAuthority,
          role: AccountRole.READONLY,
        },
        { address: messageTransmitter, role: AccountRole.READONLY },
      ],
      data,
    } as Instruction;

    return { instruction, messageSentSigner };
  }

  shouldSkipUsdcApprove(allowance: bigint, totalBurn: bigint): boolean {
    return allowance >= totalBurn;
  }

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

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}
