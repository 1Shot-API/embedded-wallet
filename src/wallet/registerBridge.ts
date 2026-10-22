import {
  ChainUtils,
  EVMAccountAddress,
  EVMContractAddress,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  SolanaAddressUtils,
  type EVMAccountAddress as EVMAccountAddressType,
  type EVMChainId as EVMChainIdType,
  type EVMContractAddress as EVMContractAddressType,
  type OWSChainId,
  type SolanaAccountAddress,
  type SolanaMintAddress,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { getAddress, parseUnits } from "viem";
import { z } from "zod";

import { openCctpBridge } from "../circle/openCctpBridge";
import { openSolanaBridge } from "../circle/openSolanaBridge";
import type { ICCTPUtils } from "../lib/interfaces/business/utils/ICCTPUtils";
import type { IChainRepository } from "../lib/interfaces/data/IChainRepository";
import type { IKnownAssetRepository } from "../lib/interfaces/data/IKnownAssetRepository";
import type { ITrackedAssetRepository } from "../lib/interfaces/data/ITrackedAssetRepository";
import { ECctpTransferSpeed } from "../lib/types/enum/ECctpTransferSpeed";

import { withWalletReady, type WalletReadyGate } from "./withWalletReady";

/** Custom RPC — host: `await proxy.rpc("bridge", { amount?, sourceChainId?, destinationChainId?, speed?, tokenAddress?, solanaRecipient? })`. */
export const BRIDGE_RPC_METHOD = "bridge";

const owsChainIdSchema = z.union([
  z.number().int().positive(),
  z.string().min(1),
]);

const bridgeParamsSchema = z
  .strictObject({
    amount: z.string().min(1).optional(),
    /** Decimal EVM chain id, or Solana CAIP-2 (`solana:mainnet` / `solana:devnet`). */
    sourceChainId: owsChainIdSchema.optional(),
    /** Decimal EVM chain id, or Solana CAIP-2 destination. */
    destinationChainId: owsChainIdSchema.optional(),
    speed: z.enum(["fast", "slow"]).optional(),
    tokenAddress: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
    /** Solana wallet when destination is Solana (EVM → Solana). */
    solanaRecipient: z.string().min(32).optional(),
    /** EVM recipient when source is Solana (Solana → EVM). */
    evmRecipient: z
      .string()
      .regex(/^0x[a-fA-F0-9]{40}$/)
      .optional(),
  })
  .default({});

export type IBridgeParams = z.infer<typeof bridgeParamsSchema>;

export type RegisterBridgeOptions = {
  ensureReady: WalletReadyGate;
  getOwnerAddress: () => EVMAccountAddressType | null;
  getSolanaAddress: () => SolanaAccountAddress | null;
  getSessionChainId: () => OWSChainId;
  chainRepository: IChainRepository;
  knownAssetRepository: IKnownAssetRepository;
  trackedAssetRepository: ITrackedAssetRepository;
  cctpUtils: ICCTPUtils;
};

function parseOwsChainIdParam(value: number | string): OWSChainId {
  if (typeof value === "string") {
    if (ChainUtils.isSolanaChainId(value)) {
      return ChainUtils.asSolanaChainId(value);
    }
    if (/^0x[0-9a-fA-F]+$/.test(value) || /^\d+$/.test(value)) {
      return ChainUtils.asEVMChainId(value);
    }
    throw new OwsInvalidParamsError(`Invalid chain id: ${value}`);
  }
  return ChainUtils.asEVMChainId(value);
}

export function evmChainIdFromDecimal(decimal: number): EVMChainIdType {
  return ChainUtils.asEVMChainId(decimal);
}

/** Host `sourceChainId` omit → the current session chain. */
export function resolveBridgeSourceChainId(
  sourceChainIdParam: number | string | undefined,
  sessionChainId: OWSChainId,
): OWSChainId {
  if (sourceChainIdParam === undefined) {
    return sessionChainId;
  }
  return parseOwsChainIdParam(sourceChainIdParam);
}

function resolveBridgeSpeed(
  speed: "fast" | "slow" | undefined,
): ECctpTransferSpeed | undefined {
  if (speed === "fast") return ECctpTransferSpeed.Fast;
  if (speed === "slow") return ECctpTransferSpeed.Slow;
  return undefined;
}

/**
 * Register host `bridge` RPC — opens CCTP USDC bridge (EVM↔Solana).
 * EVM source uses the relayer; Solana source burns via Alchemy/Kit.
 */
export function registerBridgeRpc(
  wallet: OWSWallet,
  options: RegisterBridgeOptions,
): void {
  wallet.registerRpc(
    BRIDGE_RPC_METHOD,
    withWalletReady(options.ensureReady, async (params) => {
      const {
        amount,
        sourceChainId,
        destinationChainId,
        speed,
        tokenAddress,
        solanaRecipient,
        evmRecipient,
      } = params as IBridgeParams;

      const sourceId = resolveBridgeSourceChainId(
        sourceChainId,
        options.getSessionChainId(),
      );
      const cctpSourceId = ChainUtils.isSolanaChainId(sourceId)
        ? ChainUtils.asSolanaChainId(sourceId)
        : ChainUtils.isEVMChainId(sourceId)
          ? ChainUtils.asEVMChainId(sourceId)
          : null;
      if (!cctpSourceId) {
        throw new OwsInvalidParamsError(
          `Source chain ${sourceId} is not a CCTP bridge source`,
        );
      }
      const sourceUsdc =
        await options.knownAssetRepository.getCctpBridgeAsset(cctpSourceId);
      if (!sourceUsdc) {
        throw new OwsInvalidParamsError(
          `No CCTP USDC on source chain ${sourceId}`,
        );
      }

      const sourceChain = await options.chainRepository.get(cctpSourceId);
      if (!sourceChain) {
        throw new OwsInvalidParamsError(
          `Unsupported source chain ${cctpSourceId}`,
        );
      }

      let destId: OWSChainId | undefined;
      let amountAtoms: bigint | undefined;
      if (destinationChainId !== undefined) {
        destId = parseOwsChainIdParam(destinationChainId);
        const destChain = await options.chainRepository.get(destId);
        if (
          !destChain ||
          !options.cctpUtils.isValidDestination(sourceChain, destChain)
        ) {
          throw new OwsInvalidParamsError(
            "destinationChainId must be a same-network CCTP destination",
          );
        }
      }
      if (amount !== undefined) {
        try {
          amountAtoms = parseUnits(amount, sourceUsdc.decimals);
        } catch {
          throw new OwsInvalidParamsError("amount must be a valid USDC amount");
        }
        if (amountAtoms <= 0n) {
          throw new OwsInvalidParamsError("amount must be greater than zero");
        }
      }

      const transferSpeed = resolveBridgeSpeed(speed);

      const display = await wallet.requestDisplay();
      try {
        if (ChainUtils.isSolanaChainId(cctpSourceId)) {
          return await openSolanaSourceBridge({
            options,
            sourceId: cctpSourceId,
            sourceUsdcMint: sourceUsdc.address as SolanaMintAddress,
            amountAtoms,
            destId:
              destId && ChainUtils.isEVMChainId(destId)
                ? ChainUtils.asEVMChainId(destId)
                : undefined,
            transferSpeed,
            evmRecipient,
          });
        }

        if (!sourceChain.useRelayer) {
          throw new OwsInvalidParamsError(
            `Source chain ${cctpSourceId} is not a relayer CCTP source`,
          );
        }

        const owner = options.getOwnerAddress();
        if (!owner) {
          throw new Error("Wallet is locked — unlock before bridge");
        }

        let token: EVMContractAddressType | undefined;
        if (tokenAddress !== undefined) {
          let checksummed: string;
          try {
            checksummed = getAddress(tokenAddress);
          } catch {
            throw new OwsInvalidParamsError(
              "tokenAddress must be a valid address",
            );
          }
          if (
            checksummed.toLowerCase() !==
            String(sourceUsdc.address).toLowerCase()
          ) {
            throw new OwsInvalidParamsError(
              "tokenAddress must be native CCTP USDC on the source chain",
            );
          }
          token = EVMContractAddress(checksummed as `0x${string}`);
        }

        let solRecipient: SolanaAccountAddress | undefined;
        if (solanaRecipient !== undefined) {
          try {
            solRecipient =
              SolanaAddressUtils.asAccountAddress(solanaRecipient);
          } catch {
            throw new OwsInvalidParamsError(
              "solanaRecipient must be a valid Solana address",
            );
          }
        }

        const result = await openCctpBridge({
          sourceChainId: ChainUtils.asEVMChainId(cctpSourceId),
          ownerAddress: owner,
          hostInitiated: true,
          ...(amountAtoms !== undefined ? { amountAtoms } : {}),
          ...(destId ? { destinationChainId: destId } : {}),
          ...(transferSpeed !== undefined ? { speed: transferSpeed } : {}),
          ...(token !== undefined ? { tokenAddress: token } : {}),
          ...(solRecipient ? { solanaRecipient: solRecipient } : {}),
        });
        return {
          ok: true as const,
          burnTxHash: result.burnTxHash,
          ...(result.forwardTxHash
            ? { forwardTxHash: result.forwardTxHash }
            : {}),
        };
      } catch (error: unknown) {
        if (
          error instanceof OwsUserRejectedError ||
          (error instanceof Error && /reject/i.test(error.message))
        ) {
          throw error instanceof OwsUserRejectedError
            ? error
            : new OwsUserRejectedError("User closed bridge");
        }
        throw error;
      } finally {
        await display.hide();
      }
    }),
    bridgeParamsSchema,
  );
}

async function openSolanaSourceBridge(args: {
  options: RegisterBridgeOptions;
  sourceId: ReturnType<typeof ChainUtils.asSolanaChainId>;
  sourceUsdcMint: SolanaMintAddress;
  amountAtoms: bigint | undefined;
  destId: EVMChainIdType | undefined;
  transferSpeed: ECctpTransferSpeed | undefined;
  evmRecipient: string | undefined;
}) {
  const owner = args.options.getSolanaAddress();
  if (!owner) {
    throw new Error("Wallet is locked — unlock before bridge");
  }

  const tracked = await args.options.trackedAssetRepository.list(
    args.sourceId,
  );
  const row = tracked.find(
    (a) =>
      String(a.address).toLowerCase() ===
        String(args.sourceUsdcMint).toLowerCase() && a.ataAddress,
  );
  if (!row?.ataAddress) {
    throw new OwsInvalidParamsError(
      "Track Solana USDC (create ATA) before bridging from Solana",
    );
  }

  let recipient: EVMAccountAddressType | undefined;
  if (args.evmRecipient !== undefined) {
    try {
      recipient = EVMAccountAddress(
        getAddress(args.evmRecipient) as `0x${string}`,
      );
    } catch {
      throw new OwsInvalidParamsError("evmRecipient must be a valid address");
    }
  }

  if (args.destId && !ChainUtils.isEVMChainId(args.destId)) {
    throw new OwsInvalidParamsError(
      "Solana bridge destination must be an EVM CCTP chain",
    );
  }

  const result = await openSolanaBridge({
    sourceChainId: args.sourceId,
    ownerAddress: owner,
    mint: args.sourceUsdcMint,
    burnAta: row.ataAddress,
    hostInitiated: true,
    ...(args.amountAtoms !== undefined
      ? { amountAtoms: args.amountAtoms }
      : {}),
    ...(args.destId ? { destinationChainId: args.destId } : {}),
    ...(args.transferSpeed !== undefined
      ? { speed: args.transferSpeed }
      : {}),
    ...(recipient ? { evmRecipient: recipient } : {}),
  });
  return {
    ok: true as const,
    burnTxHash: result.burnTxHash,
    ...(result.forwardTxHash ? { forwardTxHash: result.forwardTxHash } : {}),
  };
}
