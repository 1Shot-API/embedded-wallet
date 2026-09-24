import { z } from "zod";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import { EVMAccountAddressSchema, EVMChainIdSchema } from "@1shotapi/ows-types";
import {
  EWalletMode,
  useWalletSessionStore,
} from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("focusWallet", { chainId, assetAddress })`. */
export const FOCUS_WALLET_RPC_METHOD = "focusWallet";

/** Custom RPC — host: `await proxy.rpc("unfocusWallet")`. */
export const UNFOCUS_WALLET_RPC_METHOD = "unfocusWallet";

const focusWalletParamsSchema = z.strictObject({
  chainId: EVMChainIdSchema,
  assetAddress: EVMAccountAddressSchema,
});

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
