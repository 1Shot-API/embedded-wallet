import { z } from "zod";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  BitcoinSegwitAccountAddress,
  ChainUtils,
  type BitcoinChainId,
} from "@1shotapi/ows-types";
import type { IBitcoinService } from "../lib/interfaces/business";
import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import {
  loadCachedBitcoinAddress,
  saveCachedBitcoinAddress,
} from "../storage";
import { useWalletSessionStore } from "./sessionStore";
import { withWalletReady, type WalletReadyGate } from "./withWalletReady";

/** Custom RPC — host: `await proxy.rpc("getBitcoinBalance", { chainId? })`. */
export const GET_BITCOIN_BALANCE_RPC_METHOD = "getBitcoinBalance";

const bitcoinChainIdSchema = z.enum(["Bitcoin", "BitcoinTestnet"]);

const getBitcoinBalanceParamsSchema = z
  .strictObject({
    chainId: bitcoinChainIdSchema.optional(),
  })
  .default({});

export type IGetBitcoinBalanceParams = z.infer<
  typeof getBitcoinBalanceParamsSchema
>;

export type IGetBitcoinBalanceResult = {
  chainId: BitcoinChainId;
  address: BitcoinSegwitAccountAddress;
  /** Confirmed (known) balance in satoshis. */
  confirmed: string;
  /** Pending (mempool) delta in satoshis; may be negative. */
  unconfirmed: string;
};

export type RegisterGetBitcoinBalanceOptions = {
  ensureReady: WalletReadyGate;
  bitcoinService: IBitcoinService;
  owsProvider: IOWSProvider;
};

/**
 * Resolve the wallet's SegWit address for a Bitcoin network — same order as
 * BIP-122 {@link registerBitcoinProvider}: session → localStorage → signer.
 */
async function resolveBitcoinAddress(
  chainId: BitcoinChainId,
  owsProvider: IOWSProvider,
): Promise<BitcoinSegwitAccountAddress> {
  const session = useWalletSessionStore.getState();
  const cached =
    chainId === BITCOIN_MAINNET_CHAIN_ID
      ? session.bitcoinMainnetAddress
      : session.bitcoinTestnetAddress;
  if (cached) {
    return cached;
  }

  const fromStorage = loadCachedBitcoinAddress(chainId);
  if (fromStorage) {
    session.setBitcoinAddress(chainId, fromStorage);
    return fromStorage;
  }

  const signer = await owsProvider.getSigner();
  const address = await signer.bitcoin.getAccountAddress(chainId);
  session.setBitcoinAddress(chainId, address);
  saveCachedBitcoinAddress(chainId, address);

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

  return BitcoinSegwitAccountAddress(address);
}

/**
 * Register host `getBitcoinBalance` RPC — confirmed + unconfirmed satoshis
 * for the unlocked wallet on Bitcoin or Bitcoin Testnet.
 */
export function registerGetBitcoinBalanceRpc(
  wallet: OWSWallet,
  options: RegisterGetBitcoinBalanceOptions,
): void {
  wallet.registerRpc(
    GET_BITCOIN_BALANCE_RPC_METHOD,
    withWalletReady(options.ensureReady, async (params) => {
      const parsed = params as IGetBitcoinBalanceParams;
      const chainId = ChainUtils.asBitcoinChainId(
        parsed.chainId ?? BITCOIN_MAINNET_CHAIN_ID,
      );
      const address = await resolveBitcoinAddress(chainId, options.owsProvider);
      const balance = await options.bitcoinService.getBalance(chainId, address);
      return {
        chainId,
        address,
        confirmed: String(balance.confirmed),
        unconfirmed: String(balance.unconfirmed),
      } satisfies IGetBitcoinBalanceResult;
    }),
    getBitcoinBalanceParamsSchema,
  );
}
