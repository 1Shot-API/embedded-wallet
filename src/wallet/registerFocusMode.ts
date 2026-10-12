import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  ChainUtils,
  EVMContractAddress,
  EVMContractAddressSchema,
  OwsInvalidParamsError,
  type OWSChainId,
} from "@1shotapi/ows-types";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

import { EWalletMode, useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("focusWallet", { chainId, assetAddress? })`. */
export const FOCUS_WALLET_RPC_METHOD = "focusWallet";

/** Custom RPC — host: `await proxy.rpc("unfocusWallet")`. */
export const UNFOCUS_WALLET_RPC_METHOD = "unfocusWallet";

const focusWalletParamsSchema = z
  .strictObject({
    chainId: z.string().regex(/^(0x[0-9a-fA-F]+|Bitcoin|BitcoinTestnet)$/),
    /** Required for EVM; ignored for Bitcoin (native BTC is the only asset). */
    assetAddress: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (ChainUtils.isBitcoinChainId(value.chainId)) {
      return;
    }
    if (value.assetAddress == null || value.assetAddress === "") {
      ctx.addIssue({
        code: "custom",
        path: ["assetAddress"],
        message: "assetAddress is required for EVM focusWallet",
      });
      return;
    }
    const parsed = EVMContractAddressSchema.safeParse(value.assetAddress);
    if (!parsed.success) {
      ctx.addIssue({
        code: "custom",
        path: ["assetAddress"],
        message: "Invalid EVM asset address",
      });
    }
  });

export type IFocusWalletParams = z.infer<typeof focusWalletParamsSchema>;

function toOwsChainId(raw: string): OWSChainId {
  if (ChainUtils.isBitcoinChainId(raw)) {
    return ChainUtils.asBitcoinChainId(raw);
  }
  return ChainUtils.asEVMChainId(raw);
}

/**
 * Register host-controlled focus / unfocus RPCs.
 * Must run after `RpcHelper` exists and before `wallet.start()`.
 *
 * EVM: `{ chainId: "0x…", assetAddress: "0x…" }`.
 * Bitcoin: `{ chainId: "Bitcoin" | "BitcoinTestnet" }` — `assetAddress` optional/ignored.
 */
export function registerFocusModeRpc(
  wallet: OWSWallet,
  rpcHelper: RpcHelper,
): void {
  wallet.registerRpc(
    FOCUS_WALLET_RPC_METHOD,
    async (params) => {
      const { chainId: raw, assetAddress: rawAsset } =
        params as IFocusWalletParams;
      const chainId = toOwsChainId(raw);

      if (ChainUtils.isBitcoinChainId(chainId)) {
        useWalletSessionStore.getState().focusWallet(chainId, null);
        wallet.providerEvents.emit("chainChanged", chainId);
        return {
          ok: true as const,
          mode: EWalletMode.Focused,
          chainId:
            chainId === BITCOIN_MAINNET_CHAIN_ID
              ? BITCOIN_MAINNET_CHAIN_ID
              : BITCOIN_TESTNET_CHAIN_ID,
          assetAddress: null,
        };
      }

      if (rawAsset == null || rawAsset === "") {
        throw new OwsInvalidParamsError(
          "assetAddress is required for EVM focusWallet",
        );
      }
      const assetAddress = EVMContractAddress(
        EVMContractAddressSchema.parse(rawAsset),
      );
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
