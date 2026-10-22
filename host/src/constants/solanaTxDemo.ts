import type { SolanaChainId } from "@1shotapi/ows-types";
import {
  address,
  appendTransactionMessageInstructions,
  compileTransaction,
  createNoopSigner,
  createTransactionMessage,
  getTransactionEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Blockhash,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import {
  SolanaSignAndSendTransaction,
  SolanaSignTransaction,
} from "@solana/wallet-standard-features";
import { getWallets } from "@wallet-standard/app";
import type { Wallet, WalletAccount } from "@wallet-standard/base";
import { StandardConnect } from "@wallet-standard/features";
import { base58 } from "@scure/base";

/** Tiny self-transfer for playground demos (user pays fee). */
export const DEMO_SOL_TRANSFER_LAMPORTS = 1_000n;

const PUBLIC_RPC: Record<string, string> = {
  "solana:mainnet": "https://api.mainnet-beta.solana.com",
  "solana:devnet": "https://api.devnet.solana.com",
  "solana:testnet": "https://api.testnet.solana.com",
};

export function publicSolanaRpcUrl(chainId: SolanaChainId): string {
  return PUBLIC_RPC[String(chainId)] ?? PUBLIC_RPC["solana:devnet"]!;
}

export async function fetchLatestBlockhash(
  chainId: SolanaChainId,
): Promise<{ blockhash: string; lastValidBlockHeight: bigint }> {
  const response = await fetch(publicSolanaRpcUrl(chainId), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getLatestBlockhash",
      params: [{ commitment: "confirmed" }],
    }),
  });
  if (!response.ok) {
    throw new Error(`Solana RPC HTTP ${response.status}`);
  }
  const body = (await response.json()) as {
    result?: { value: { blockhash: string; lastValidBlockHeight: number } };
    error?: { message?: string };
  };
  if (body.error) {
    throw new Error(body.error.message ?? "getLatestBlockhash failed");
  }
  if (!body.result?.value) {
    throw new Error("getLatestBlockhash missing result");
  }
  return {
    blockhash: body.result.value.blockhash,
    lastValidBlockHeight: BigInt(body.result.value.lastValidBlockHeight),
  };
}

/**
 * Build an unsigned System Program SOL transfer as Wallet Standard wire bytes
 * (Host demo only — Branding submits via Alchemy on signAndSend).
 */
export async function buildDemoSolTransferWire(params: {
  chainId: SolanaChainId;
  from: string;
  /** Defaults to `from` (self-transfer). */
  to?: string;
  lamports?: bigint;
}): Promise<Uint8Array> {
  const { blockhash, lastValidBlockHeight } = await fetchLatestBlockhash(
    params.chainId,
  );
  const from = address(params.from);
  const to = address(params.to ?? params.from);
  const lamports = params.lamports ?? DEMO_SOL_TRANSFER_LAMPORTS;
  const sourceSigner = createNoopSigner(from);

  const transfer = getTransferSolInstruction({
    source: sourceSigner,
    destination: to,
    amount: lamports,
  });

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(from, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        {
          blockhash: blockhash as Blockhash,
          lastValidBlockHeight,
        },
        m,
      ),
    (m) => appendTransactionMessageInstructions([transfer], m),
  );

  const compiled = compileTransaction(message);
  return new Uint8Array(getTransactionEncoder().encode(compiled));
}

export function findOwsSolanaWallet(): Wallet {
  const wallet = getWallets()
    .get()
    .find((candidate) => candidate.name === "1Shot Wallet");
  if (!wallet) {
    throw new Error(
      'Wallet Standard "1Shot Wallet" not registered — call proxy.solana.registerSolanaWallet()',
    );
  }
  return wallet;
}

export async function ensureOwsSolanaConnected(): Promise<WalletAccount> {
  const wallet = findOwsSolanaWallet();
  if (wallet.accounts.length === 0) {
    const connectFeature = wallet.features[StandardConnect] as
      | { connect: () => Promise<{ accounts: readonly WalletAccount[] }> }
      | undefined;
    if (!connectFeature?.connect) {
      throw new Error("Wallet Standard connect is unavailable");
    }
    await connectFeature.connect();
  }
  const account = wallet.accounts[0];
  if (!account) {
    throw new Error("Connect the Solana Wallet Standard account first");
  }
  return account;
}

export function requireSolanaAccount(
  wallet: Wallet,
  expectedAddress?: string,
): WalletAccount {
  const account =
    (expectedAddress
      ? wallet.accounts.find((a) => a.address === expectedAddress)
      : wallet.accounts[0]) ?? wallet.accounts[0];
  if (!account) {
    throw new Error("Connect the Solana Wallet Standard account first");
  }
  return account;
}

export async function standardSignAndSendDemo(params: {
  chainId: SolanaChainId;
  accountAddress: string;
  wireTransaction: Uint8Array;
}): Promise<string> {
  const wallet = findOwsSolanaWallet();
  const feature = wallet.features[SolanaSignAndSendTransaction] as
    | { signAndSendTransaction: (...inputs: unknown[]) => Promise<unknown> }
    | undefined;
  if (!feature?.signAndSendTransaction) {
    throw new Error("Wallet does not support solana:signAndSendTransaction");
  }
  const account = requireSolanaAccount(wallet, params.accountAddress);
  const outputs = (await feature.signAndSendTransaction({
    account,
    chain: params.chainId,
    transaction: params.wireTransaction,
  })) as ReadonlyArray<{ signature: Uint8Array }>;
  const signature = outputs[0]?.signature;
  if (!signature) {
    throw new Error("signAndSendTransaction returned no signature");
  }
  return base58.encode(signature);
}

export async function standardSignTransactionDemo(params: {
  accountAddress: string;
  wireTransaction: Uint8Array;
}): Promise<string> {
  const wallet = findOwsSolanaWallet();
  const feature = wallet.features[SolanaSignTransaction] as
    | { signTransaction: (...inputs: unknown[]) => Promise<unknown> }
    | undefined;
  if (!feature?.signTransaction) {
    throw new Error("Wallet does not support solana:signTransaction");
  }
  const account = requireSolanaAccount(wallet, params.accountAddress);
  const outputs = (await feature.signTransaction({
    account,
    transaction: params.wireTransaction,
  })) as ReadonlyArray<{ signedTransaction: Uint8Array }>;
  const signed = outputs[0]?.signedTransaction;
  if (!signed) {
    throw new Error("signTransaction returned no signed transaction");
  }
  // Host demo: return base64 wire so the playground can display it.
  let binary = "";
  for (const byte of signed) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
