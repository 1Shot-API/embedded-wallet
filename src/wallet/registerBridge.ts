import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMChainId,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type EVMAccountAddress,
  type EVMChainId as EVMChainIdType,
} from "@1shotapi/ows-types";
import { parseUnits } from "viem";
import { openCctpBridge } from "../circle/openCctpBridge";
import type { IChainRepository } from "../lib/interfaces/data/IChainRepository";
import type { IKnownAssetRepository } from "../lib/interfaces/data/IKnownAssetRepository";
import type { ICCTPUtils } from "../lib/interfaces/business/utils/ICCTPUtils";

/** Custom RPC — host: `await proxy.rpc("bridge", { amount?, sourceChainId?, destinationChainId? })`. */
export const BRIDGE_RPC_METHOD = "bridge";

const bridgeParamsSchema = z
  .strictObject({
    amount: z.string().min(1).optional(),
    sourceChainId: z.number().int().positive().optional(),
    destinationChainId: z.number().int().positive().optional(),
  })
  .default({});

export type IBridgeParams = z.infer<typeof bridgeParamsSchema>;

export type RegisterBridgeOptions = {
  getOwnerAddress: () => EVMAccountAddress | null;
  getSessionChainId: () => EVMChainIdType;
  chainRepository: IChainRepository;
  knownAssetRepository: IKnownAssetRepository;
  cctpUtils: ICCTPUtils;
};

export function evmChainIdFromDecimal(decimal: number): EVMChainIdType {
  return EVMChainId(`0x${decimal.toString(16)}`);
}

/** Host `sourceChainId` is decimal; omit → the current session chain. */
export function resolveBridgeSourceChainId(
  sourceChainIdDecimal: number | undefined,
  sessionChainId: EVMChainIdType,
): EVMChainIdType {
  if (sourceChainIdDecimal === undefined) {
    return sessionChainId;
  }
  return evmChainIdFromDecimal(sourceChainIdDecimal);
}

/**
 * Register host `bridge` RPC — opens the CCTP USDC bridge for the unlocked
 * EVM address on a relayer CCTP source chain.
 */
export function registerBridgeRpc(
  wallet: OWSWallet,
  options: RegisterBridgeOptions,
): void {
  wallet.registerRpc(
    BRIDGE_RPC_METHOD,
    async (params) => {
      const { amount, sourceChainId, destinationChainId } =
        params as IBridgeParams;
      const owner = options.getOwnerAddress();
      if (!owner) {
        throw new Error("Wallet is locked — unlock before bridge");
      }

      const sourceId = resolveBridgeSourceChainId(
        sourceChainId,
        options.getSessionChainId(),
      );
      const sourceUsdc =
        await options.knownAssetRepository.getCctpBridgeAsset(sourceId);
      if (!sourceUsdc) {
        throw new OwsInvalidParamsError(
          `No CCTP USDC on source chain ${sourceId}`,
        );
      }

      const sourceChain = await options.chainRepository.get(sourceId);
      if (!sourceChain?.useRelayer) {
        throw new OwsInvalidParamsError(
          `Source chain ${sourceId} is not a relayer CCTP source`,
        );
      }

      let destId: EVMChainIdType | undefined;
      let amountAtoms: bigint | undefined;
      if (destinationChainId !== undefined) {
        destId = evmChainIdFromDecimal(destinationChainId);
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

      const display = await wallet.requestDisplay();
      try {
        const result = await openCctpBridge({
          sourceChainId: sourceId,
          ownerAddress: owner,
          ...(amountAtoms !== undefined ? { amountAtoms } : {}),
          ...(destId ? { destinationChainId: destId } : {}),
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
    },
    bridgeParamsSchema,
  );
}
