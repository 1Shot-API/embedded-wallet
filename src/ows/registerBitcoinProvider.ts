import {
  BITCOIN_MAINNET_CHAIN_ID,
  BitcoinChainId,
  BitcoinSegwitAccountAddress,
  ChainUtils,
  ConversionUtils,
  HexString,
  OwsInvalidParamsError,
  type IBitcoinGetAccountAddressesParams,
  type IOpenWalletBitcoinProvider,
} from "@1shotapi/ows-types";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import { z } from "zod";

import {
  assertBitcoinAddress,
  bip322SimpleProof,
  bip322SimpleSighash,
  bitcoinMessageHash,
  bitcoinMessageSignatureHex,
  compressedKeyFromPublicKey,
  describePsbtSpend,
  finalizedPsbtHex,
  parseBitcoinMemo,
  psbtInputSighashes,
  psbtWithSignatures,
  sameBitcoinAddress,
} from "../lib/implementations/utils/bitcoinHostSigning";
import type { IBitcoinService } from "../lib/interfaces/business/IBitcoinService";
import type { IOWSProvider } from "../lib/interfaces/utils/IOWSProvider";
import { makeBitcoinSatoshiAmount } from "../lib/types/primitives/BitcoinSatoshiAmount";
import { makeBitcoinTransactionData } from "../lib/types/primitives/BitcoinTransactionData";
import { loadCachedBitcoinAddress } from "../storage";
import { secpKeyForAddress } from "../wallet/hydrateBitcoinAddresses";
import type { ActiveModal } from "../wallet/modalTypes";
import { useWalletSessionStore } from "../wallet/sessionStore";

export type RegisterBitcoinProviderOptions = {
  owsProvider: IOWSProvider;
  ensureReady: () => Promise<void>;
  bitcoinService: IBitcoinService;
  ask: <T>(
    build: (handlers: {
      id: string;
      resolve: (value: T) => void;
      reject: (error: unknown) => void;
    }) => ActiveModal,
  ) => Promise<T>;
};

const chainIdSchema = z.enum(["Bitcoin", "BitcoinTestnet"]);

function formatSats(sats: bigint): string {
  const whole = sats / 100_000_000n;
  const fraction = (sats % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction} BTC` : `${whole} BTC`;
}

function walletChain(
  requested: string | undefined,
  fallback: BitcoinChainId,
): BitcoinChainId {
  return requested === "Bitcoin" || requested === "BitcoinTestnet"
    ? BitcoinChainId(requested)
    : fallback;
}

function networkBadge(chainId: BitcoinChainId): { name: string; testnet: boolean } {
  const testnet = chainId !== BITCOIN_MAINNET_CHAIN_ID;
  return { name: testnet ? "Bitcoin testnet" : "Bitcoin", testnet };
}

function requireThisAccount(account: string | undefined, address: string): void {
  if (account !== undefined && !sameBitcoinAddress(account, address)) {
    throw new OwsInvalidParamsError("Bitcoin account is not this wallet");
  }
}

function sessionBitcoinAddress(chainId: BitcoinChainId) {
  const session = useWalletSessionStore.getState();
  const cached =
    chainId === BITCOIN_MAINNET_CHAIN_ID
      ? session.bitcoinMainnetAddress
      : session.bitcoinTestnetAddress;
  if (cached) return cached;
  const fromStorage = loadCachedBitcoinAddress(chainId);
  if (!fromStorage) return undefined;
  session.setBitcoinAddress(chainId, fromStorage);
  return fromStorage;
}

/**
 * Session or localStorage address, paired with a secp256k1 key that derives
 * to it. A missing or mismatched key calls `getPublicKey` and replaces the
 * stored address with the passkey key.
 */
async function resolveBitcoinSigner(
  chainId: BitcoinChainId,
  signer: Awaited<ReturnType<IOWSProvider["getSigner"]>>,
) {
  return secpKeyForAddress(signer, chainId, sessionBitcoinAddress(chainId));
}

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
      if (
        params?.intentions !== undefined &&
        !params.intentions.includes("payment")
      ) {
        return [];
      }

      const session = useWalletSessionStore.getState();
      const requested = params?.chainId;
      const chainId =
        requested !== undefined
          ? ChainUtils.asBitcoinChainId(requested)
          : ChainUtils.isBitcoinChainId(session.chainId)
            ? ChainUtils.asBitcoinChainId(session.chainId)
            : BITCOIN_MAINNET_CHAIN_ID;

      const signer = await options.owsProvider.getSigner();
      const { address, publicKey } = await resolveBitcoinSigner(chainId, signer);
      requireThisAccount(params?.account, address);
      const publicKeyHex = publicKey?.replace(/^0x/i, "");
      return [
        {
          address: BitcoinSegwitAccountAddress(address),
          ...(publicKeyHex ? { publicKey: publicKeyHex } : {}),
          intention: "payment" as const,
        },
      ];
    },
  };

  wallet.bitcoin.register(provider);

  const confirm = (request: {
    title: string;
    body: string;
    network?: { name: string; testnet: boolean };
    outputs?: Array<{ address: string; amount?: string; label?: string }>;
    fee?: string;
    signerAddress?: string;
  }) =>
    options.ask<void>(({ id, resolve, reject }) => ({
      id,
      kind: "bitcoinHostSign",
      ...request,
      resolve,
      reject,
    }));

  wallet.registerRpc(
    "bitcoin.signPsbt",
    async (params) => {
      const body = params as {
        psbt: string;
        signInputs: Array<{
          address: string;
          index: number;
          sighashTypes?: number[];
        }>;
        broadcast?: boolean;
        chainId?: BitcoinChainId;
        account?: string;
      };
      const chainId = walletChain(body.chainId, BITCOIN_MAINNET_CHAIN_ID);
      const signer = await options.owsProvider.getSigner();
      const { address, publicKey } = await resolveBitcoinSigner(chainId, signer);
      requireThisAccount(body.account, address);
      if (!publicKey) {
        throw new OwsInvalidParamsError("Bitcoin public key is not available");
      }
      const compressed = compressedKeyFromPublicKey(publicKey);
      const spend = describePsbtSpend({
        psbtBase64: body.psbt,
        signInputs: body.signInputs,
        walletAddress: address,
        compressedPublicKey: compressed,
        chainId,
      });
      try {
        await confirm({
          title: "Sign Bitcoin transaction",
          body: "",
          network: networkBadge(chainId),
          outputs: spend.outputs.map((output) => ({
            address: output.address,
            amount: formatSats(output.amountSats),
            ...(output.address.startsWith("OP_RETURN") ? { label: "Data" } : {}),
          })),
          ...(spend.feeSats !== null ? { fee: formatSats(spend.feeSats) } : {}),
        });
        const indexes = body.signInputs.map((input) => input.index);
        const sighashes = psbtInputSighashes({
          psbtBase64: body.psbt,
          inputIndexes: indexes,
          compressedPublicKey: compressed,
          chainId,
          sighashTypes: spend.sighashTypes,
        });
        const signed = await signer.signDigest(
          sighashes.map((sighash) => ({
            digestData: ConversionUtils.bytesToHex(sighash),
            scheme: "secp256k1-ecdsa" as const,
          })),
        );
        const psbt = psbtWithSignatures({
          psbtBase64: body.psbt,
          inputIndexes: indexes,
          compactSignatures: signed.map((result) =>
            ConversionUtils.hexToBytes(HexString(result.signature)),
          ),
          compressedPublicKey: compressed,
          sighashTypes: spend.sighashTypes,
        });
        if (!body.broadcast) return { psbt };
        const txid = String(
          await options.bitcoinService.broadcast(
            chainId,
            makeBitcoinTransactionData(finalizedPsbtHex(psbt)),
          ),
        ).replace(/^0x/i, "");
        return { psbt, txid };
      } finally {
        await options.owsProvider.hideDisplay().catch(() => undefined);
      }
    },
    z.object({
      psbt: z.string().min(1),
      signInputs: z
        .array(
          z.object({
            address: z.string().min(1),
            index: z.number().int().nonnegative(),
            sighashTypes: z.array(z.number().int()).optional(),
          }),
        )
        .min(1),
      broadcast: z.boolean().optional(),
      chainId: chainIdSchema.optional(),
      account: z.string().optional(),
    }),
  );

  wallet.registerRpc(
    "bitcoin.signMessage",
    async (params) => {
      const body = params as {
        message: string;
        account?: string;
        address?: string;
        protocol?: "ecdsa" | "bip322";
        chainId?: BitcoinChainId;
      };
      const chainId = walletChain(body.chainId, BITCOIN_MAINNET_CHAIN_ID);
      const signer = await options.owsProvider.getSigner();
      const { address, publicKey } = await resolveBitcoinSigner(chainId, signer);
      requireThisAccount(body.account, address);
      if (body.address !== undefined && !sameBitcoinAddress(body.address, address)) {
        throw new OwsInvalidParamsError("Bitcoin address is not this wallet");
      }
      if (body.protocol === "bip322" && !publicKey) {
        throw new OwsInvalidParamsError("Bitcoin public key is not available");
      }
      try {
        await confirm({
          title: "Sign Bitcoin message",
          body: body.message,
          network: networkBadge(chainId),
          signerAddress: address,
        });
        if (body.protocol === "bip322" && publicKey) {
          const compressed = compressedKeyFromPublicKey(publicKey);
          const digest = bip322SimpleSighash({
            message: body.message,
            compressedPublicKey: compressed,
            chainId,
          });
          const [signed] = await signer.signDigest([
            {
              digestData: ConversionUtils.bytesToHex(digest),
              scheme: "secp256k1-ecdsa" as const,
            },
          ]);
          if (!signed) {
            throw new OwsInvalidParamsError("Bitcoin message signing returned no signature");
          }
          const proof = bip322SimpleProof({
            message: body.message,
            compressedPublicKey: compressed,
            chainId,
            compactSignature: ConversionUtils.hexToBytes(HexString(signed.signature)),
          });
          return {
            address,
            signature: proof.signatureHex,
            messageHash: proof.messageHashHex,
          };
        }
        const digest = bitcoinMessageHash(body.message);
        const [signed] = await signer.signDigest([
          {
            digestData: ConversionUtils.bytesToHex(digest),
            scheme: "secp256k1-ecdsa-recoverable",
          },
        ]);
        if (!signed) {
          throw new OwsInvalidParamsError("Bitcoin message signing returned no signature");
        }
        return {
          address,
          signature: bitcoinMessageSignatureHex(
            ConversionUtils.hexToBytes(HexString(signed.signature)),
          ),
          messageHash: ConversionUtils.bytesToHex(digest).slice(2),
        };
      } finally {
        await options.owsProvider.hideDisplay().catch(() => undefined);
      }
    },
    z.object({
      message: z.string(),
      account: z.string().optional(),
      address: z.string().optional(),
      protocol: z.enum(["ecdsa", "bip322"]).optional(),
      chainId: chainIdSchema.optional(),
    }),
  );

  wallet.registerRpc(
    "bitcoin.sendTransfer",
    async (params) => {
      const body = params as {
        account?: string;
        recipientAddress?: string;
        amount?: string;
        changeAddress?: string;
        memo?: string;
        chainId?: BitcoinChainId;
      };
      if (!body.recipientAddress) {
        throw new OwsInvalidParamsError("Bitcoin recipient is required");
      }
      if (!body.amount || !/^[1-9]\d*$/.test(body.amount)) {
        throw new OwsInvalidParamsError(
          "Bitcoin amount must be a positive number of satoshis",
        );
      }
      const chainId = walletChain(body.chainId, BITCOIN_MAINNET_CHAIN_ID);
      const memo = parseBitcoinMemo(body.memo);
      assertBitcoinAddress(body.recipientAddress, chainId);
      const signer = await options.owsProvider.getSigner();
      const { address: from } = await resolveBitcoinSigner(chainId, signer);
      requireThisAccount(body.account, from);
      if (body.changeAddress !== undefined) {
        assertBitcoinAddress(body.changeAddress, chainId);
      }
      const amountSats = makeBitcoinSatoshiAmount(BigInt(body.amount));
      try {
        const sent = await options.bitcoinService.send({
          chainId,
          from,
          to: body.recipientAddress,
          amountSats,
          ...(body.changeAddress !== undefined
            ? { changeAddress: body.changeAddress }
            : {}),
          ...(memo ? { memo } : {}),
          confirmSpend: async (quote) => {
            await confirm({
              title: "Send Bitcoin",
              body: "",
              network: networkBadge(chainId),
              outputs: [
                {
                  address: body.recipientAddress!,
                  amount: formatSats(amountSats),
                },
                ...(quote.changeAddress
                  ? [
                      {
                        label: "Change",
                        address: quote.changeAddress,
                        amount: formatSats(quote.changeSats),
                      },
                    ]
                  : []),
                ...(memo
                  ? [
                      {
                        label: "Data",
                        address: ConversionUtils.bytesToHex(memo).slice(2),
                      },
                    ]
                  : []),
              ],
              fee: formatSats(quote.feeSats),
            });
          },
        });
        const txid = String(sent.txid).replace(/^0x/i, "");
        return { txid };
      } finally {
        await options.owsProvider.hideDisplay().catch(() => undefined);
      }
    },
    z.object({
      account: z.string().optional(),
      recipientAddress: z.string().min(1),
      amount: z.string().regex(/^[1-9]\d*$/),
      changeAddress: z.string().optional(),
      memo: z.string().optional(),
      chainId: chainIdSchema.optional(),
    }),
  );
}
