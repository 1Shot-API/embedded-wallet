import { z } from "zod";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  ChainUtils,
  type OWSChainId,
} from "@1shotapi/ows-types";
import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("switchChain", { chainId })`. */
export const SWITCH_CHAIN_RPC_METHOD = "switchChain";

const switchChainParamsSchema = z.strictObject({
  chainId: z.string().regex(/^(0x[0-9a-fA-F]+|Bitcoin|BitcoinTestnet)$/),
});

export type ISwitchChainParams = z.infer<typeof switchChainParamsSchema>;

function toOwsChainId(raw: string): OWSChainId {
  if (ChainUtils.isBitcoinChainId(raw)) {
    return ChainUtils.asBitcoinChainId(raw);
  }
  return ChainUtils.asEVMChainId(raw);
}

/**
 * Host chain switch that accepts EVM hex ids and Bitcoin sentinels
 * (`Bitcoin` / `BitcoinTestnet`). Bitcoin is session-only (no EIP-1193);
 * EVM goes through {@link RpcHelper.switchChain}.
 */
export function registerSwitchChainRpc(
  wallet: OWSWallet,
  rpcHelper: RpcHelper,
): void {
  wallet.registerRpc(
    SWITCH_CHAIN_RPC_METHOD,
    async (params) => {
      const { chainId: raw } = params as ISwitchChainParams;
      const chainId = toOwsChainId(raw);

      if (ChainUtils.isBitcoinChainId(chainId)) {
        useWalletSessionStore.getState().setChainId(chainId);
        return {
          ok: true as const,
          chainId:
            chainId === BITCOIN_MAINNET_CHAIN_ID
              ? BITCOIN_MAINNET_CHAIN_ID
              : BITCOIN_TESTNET_CHAIN_ID,
        };
      }

      await rpcHelper.switchChain(String(chainId));
      useWalletSessionStore.getState().setChainId(chainId);
      return {
        ok: true as const,
        chainId,
      };
    },
    switchChainParamsSchema,
  );
}
