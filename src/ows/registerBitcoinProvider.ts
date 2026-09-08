import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  BitcoinSegwitAccountAddress,
  ChainUtils,
  type IBitcoinGetAccountAddressesParams,
  type IOpenWalletBitcoinProvider,
} from "@1shotapi/ows-types";
import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import {
  loadCachedBitcoinAddress,
  saveCachedBitcoinAddress,
} from "../storage";
import { useWalletSessionStore } from "../wallet/sessionStore";

export type RegisterBitcoinProviderOptions = {
  owsProvider: IOWSProvider;
  ensureReady: () => Promise<void>;
};

/**
 * Branding-side BIP-122 `getAccountAddresses` — returns the single static
 * SegWit address for the requested / session Bitcoin network.
 */
export function registerBitcoinProvider(
  wallet: OWSWallet,
  options: RegisterBitcoinProviderOptions,
): void {
  const provider: IOpenWalletBitcoinProvider = {
    async getAccountAddresses(params?: IBitcoinGetAccountAddressesParams) {
      await options.ensureReady();

      const session = useWalletSessionStore.getState();
      const requested = params?.chainId;
      const chainId =
        requested !== undefined
          ? ChainUtils.asBitcoinChainId(requested)
          : ChainUtils.isBitcoinChainId(session.chainId)
            ? ChainUtils.asBitcoinChainId(session.chainId)
            : BITCOIN_MAINNET_CHAIN_ID;

      const cached =
        chainId === BITCOIN_MAINNET_CHAIN_ID
          ? session.bitcoinMainnetAddress
          : session.bitcoinTestnetAddress;
      if (cached) {
        return [
          {
            address: cached,
            intention: "payment" as const,
          },
        ];
      }

      const fromStorage = loadCachedBitcoinAddress(chainId);
      if (fromStorage) {
        session.setBitcoinAddress(chainId, fromStorage);
        return [
          {
            address: fromStorage,
            intention: "payment" as const,
          },
        ];
      }

      const signer = await options.owsProvider.getSigner();
      const address = await signer.bitcoin.getAccountAddress(chainId);
      session.setBitcoinAddress(chainId, address);
      saveCachedBitcoinAddress(chainId, address);

      // Best-effort: also warm the other network from the same pubkey cache.
      const other =
        chainId === BITCOIN_MAINNET_CHAIN_ID
          ? BITCOIN_TESTNET_CHAIN_ID
          : BITCOIN_MAINNET_CHAIN_ID;
      try {
        const otherAddress = await signer.bitcoin.getAccountAddress(other);
        session.setBitcoinAddress(other, otherAddress);
        saveCachedBitcoinAddress(other, otherAddress);
      } catch {
        /* ignore */
      }

      const publicKey = signer
        .getLastPublicKeyData?.()
        ?.secp256k1PublicKey?.replace(/^0x/i, "");

      return [
        {
          address: BitcoinSegwitAccountAddress(address),
          publicKey,
          intention: "payment" as const,
        },
      ];
    },
  };

  wallet.bitcoin.register(provider);
}
