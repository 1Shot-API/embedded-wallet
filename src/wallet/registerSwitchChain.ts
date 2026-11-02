import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  ChainUtils,
  SOLANA_DEVNET_CHAIN_ID,
  SOLANA_MAINNET_CHAIN_ID,
  type OWSChainId,
} from "@1shotapi/ows-types";
import type { OWSWallet, RpcHelper } from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

import { useWalletSessionStore } from "./sessionStore";

/** Custom RPC — host: `await proxy.rpc("switchChain", { chainId })`. */
export const SWITCH_CHAIN_RPC_METHOD = "switchChain";

/** Custom RPC — host: `await proxy.rpc("getChainId")` — session OWS chain. */
export const GET_CHAIN_ID_RPC_METHOD = "getChainId";

const switchChainParamsSchema = z.strictObject({
  chainId: z
    .string()
    .regex(
      /^(0x[0-9a-fA-F]+|Bitcoin|BitcoinTestnet|solana:mainnet|solana:devnet)$/,
    ),
});

export type ISwitchChainParams = z.infer<typeof switchChainParamsSchema>;

function toOwsChainId(raw: string): OWSChainId {
  if (ChainUtils.isBitcoinChainId(raw)) {
    return ChainUtils.asBitcoinChainId(raw);
  }
  if (ChainUtils.isSolanaChainId(raw)) {
    return ChainUtils.asSolanaChainId(raw);
  }
  return ChainUtils.asEVMChainId(raw);
}

function clearFocusedAssetIfNeeded(): void {
  const session = useWalletSessionStore.getState();
  if (session.focusedAssetAddress) {
    session.setFocusedAssetAddress(null);
  }
}

/**
 * Host chain switch that accepts EVM hex ids, Bitcoin sentinels, and Solana
 * CAIP-2 ids. Bitcoin / Solana are session-only (no EIP-1193); EVM goes through
 * {@link RpcHelper.switchChain}.
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
        const session = useWalletSessionStore.getState();
        session.setChainId(chainId);
        clearFocusedAssetIfNeeded();
        wallet.providerEvents.emit("chainChanged", chainId);
        return {
          ok: true as const,
          chainId:
            chainId === BITCOIN_MAINNET_CHAIN_ID
              ? BITCOIN_MAINNET_CHAIN_ID
              : BITCOIN_TESTNET_CHAIN_ID,
        };
      }

      if (ChainUtils.isSolanaChainId(chainId)) {
        const session = useWalletSessionStore.getState();
        session.setChainId(chainId);
        clearFocusedAssetIfNeeded();
        wallet.providerEvents.emit("chainChanged", chainId);
        return {
          ok: true as const,
          chainId:
            chainId === SOLANA_MAINNET_CHAIN_ID
              ? SOLANA_MAINNET_CHAIN_ID
              : SOLANA_DEVNET_CHAIN_ID,
        };
      }

      await rpcHelper.switchChain(String(chainId));
      const session = useWalletSessionStore.getState();
      if (
        String(session.chainId).toLowerCase() !== String(chainId).toLowerCase()
      ) {
        session.setChainId(chainId);
        wallet.providerEvents.emit("chainChanged", chainId);
      }
      return {
        ok: true as const,
        chainId,
      };
    },
    switchChainParamsSchema,
  );

  wallet.registerRpc(GET_CHAIN_ID_RPC_METHOD, async () => ({
    chainId: useWalletSessionStore.getState().chainId,
  }));
}
