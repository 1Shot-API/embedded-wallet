import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  ChainUtils,
  type EVMAccountAddress,
  type EVMContractAddress,
} from "@1shotapi/ows-types";
import type { ITransactionService } from "../lib/interfaces/business";
import { withWalletReady, type WalletReadyGate } from "./withWalletReady";

/** Custom RPC — host: `await proxy.rpc("getUpgraded", { chainId })`. */
export const GET_UPGRADED_RPC_METHOD = "getUpgraded";

const getUpgradedParamsSchema = z.strictObject({
  chainId: z.string().regex(/^(0x[0-9a-fA-F]+|Bitcoin|BitcoinTestnet)$/),
});

export type IGetUpgradedParams = z.infer<typeof getUpgradedParamsSchema>;

export type IGetUpgradedResult = {
  upgraded: boolean;
  codeAddress?: EVMContractAddress;
  error?: string;
};

export type RegisterGetUpgradedOptions = {
  ensureReady: WalletReadyGate;
  getOwnerAddress: () => EVMAccountAddress | null;
  transactionService: ITransactionService;
};

/**
 * Register host `getUpgraded` RPC — read-only EIP-7702 status for the
 * unlocked EOA on a chain. Non-EVM chain ids return a soft error in the
 * result (not a thrown RPC error).
 */
export function registerGetUpgradedRpc(
  wallet: OWSWallet,
  options: RegisterGetUpgradedOptions,
): void {
  wallet.registerRpc(
    GET_UPGRADED_RPC_METHOD,
    withWalletReady(options.ensureReady, async (params) => {
      const { chainId: raw } = params as IGetUpgradedParams;

      if (ChainUtils.isBitcoinChainId(raw)) {
        return {
          upgraded: false,
          error: `Chain ${raw} is not an EVM chain`,
        } satisfies IGetUpgradedResult;
      }

      const owner = options.getOwnerAddress();
      if (!owner) {
        throw new Error("Wallet is locked — unlock before getUpgraded");
      }

      try {
        const chainId = ChainUtils.asEVMChainId(raw);
        const status = await options.transactionService.getWalletUpgradeStatus(
          chainId,
          owner,
        );
        return {
          upgraded: status.upgraded,
          ...(status.codeAddress ? { codeAddress: status.codeAddress } : {}),
        } satisfies IGetUpgradedResult;
      } catch (error: unknown) {
        return {
          upgraded: false,
          error:
            error instanceof Error
              ? error.message
              : `Failed to check upgrade status for chain ${raw}`,
        } satisfies IGetUpgradedResult;
      }
    }),
    getUpgradedParamsSchema,
  );
}
