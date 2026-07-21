import { z } from "zod";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import {
  EWalletMode,
  useWalletSessionStore,
} from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("focusWallet", { chainId, assetAddress })`. */
export const FOCUS_WALLET_RPC_METHOD = "focusWallet";

/** Custom RPC — host: `await proxy.rpc("unfocusWallet")`. */
export const UNFOCUS_WALLET_RPC_METHOD = "unfocusWallet";

const focusWalletParamsSchema = z
  .object({
    chainId: z
      .string()
      .regex(/^0x[0-9a-fA-F]+$/)
      .transform((value) => EVMChainId(value as `0x${string}`)),
    assetAddress: z
      .string()
      .regex(/^0x[0-9a-fA-F]{40}$/)
      .transform((value) => EVMAccountAddress(value as `0x${string}`)),
  })
  .strict();

export type IFocusWalletParams = z.infer<typeof focusWalletParamsSchema>;

/**
 * Register host-controlled focus / unfocus RPCs.
 * Must run after `RpcHelper` exists and before `wallet.start()`.
 */
export function registerFocusModeRpc(
  wallet: OWSWallet,
  rpcHelper: RpcHelper,
): void {
  wallet.registerRpc(
    FOCUS_WALLET_RPC_METHOD,
    async (params) => {
      const { chainId, assetAddress } = params as IFocusWalletParams;
      await rpcHelper.switchChain(chainId);
      useWalletSessionStore.getState().focusWallet(chainId, assetAddress);
      return {
        ok: true as const,
        mode: EWalletMode.Focused,
        chainId,
        assetAddress,
      };
    },
    focusWalletParamsSchema,
  );

  wallet.registerRpc(UNFOCUS_WALLET_RPC_METHOD, async () => {
    useWalletSessionStore.getState().unfocusWallet();
    return {
      ok: true as const,
      mode: EWalletMode.General,
    };
  });
}
