import {
  SolanaAddressUtils,
  SolanaTransactionHash,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaChainId,
  type SolanaMintAddress,
  type SolanaProgramAddress,
} from "@1shotapi/ows-types";

import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type {
  ISolanaBlockhash,
  ISolanaParsedTokenBalance,
  ISolanaParsedTransaction,
  ISolanaRpc,
  ISolanaSignatureInfo,
  ISolanaSimulateResult,
  ISolanaTokenAccountBalance,
} from "../../interfaces/data/ISolanaRpc";
import {
  makeSolanaLamports,
  type SolanaLamports,
} from "../../types/primitives/SolanaLamports";

interface IJsonRpcResponse<T> {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: { code?: number; message?: string };
}

/**
 * Alchemy Solana JSON-RPC using the catalog HTTPS URL from
 * {@link IChainRepository}.
 */
export class AlchemySolanaRpc implements ISolanaRpc {
  constructor(protected readonly chainRepository: IChainRepository) {}

  async getBalance(
    chainId: SolanaChainId,
    address: SolanaAccountAddress,
  ): Promise<SolanaLamports> {
    const result = await this.rpcCall<{ value: number }>(chainId, "getBalance", [
      address,
      { commitment: "confirmed" },
    ]);
    return makeSolanaLamports(BigInt(result.value));
  }

  async getLatestBlockhash(chainId: SolanaChainId): Promise<ISolanaBlockhash> {
    const result = await this.rpcCall<{
      value: { blockhash: string; lastValidBlockHeight: number };
    }>(chainId, "getLatestBlockhash", [{ commitment: "confirmed" }]);
    return {
      blockhash: result.value.blockhash,
      lastValidBlockHeight: BigInt(result.value.lastValidBlockHeight),
    };
  }

  async simulateTransaction(
    chainId: SolanaChainId,
    wireTransactionBase64: string,
  ): Promise<ISolanaSimulateResult> {
    const result = await this.rpcCall<{
      value: { err: unknown | null; logs?: string[] | null };
    }>(chainId, "simulateTransaction", [
      wireTransactionBase64,
      {
        encoding: "base64",
        sigVerify: false,
        commitment: "confirmed",
      },
    ]);
    return {
      err: result.value.err ?? null,
      ...(result.value.logs ? { logs: [...result.value.logs] } : {}),
    };
  }

  async sendRawTransaction(
    chainId: SolanaChainId,
    wireTransactionBase64: string,
  ): Promise<SolanaTransactionHash> {
    const signature = await this.rpcCall<string>(chainId, "sendTransaction", [
      wireTransactionBase64,
      {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    ]);
    return SolanaTransactionHash(signature);
  }

  async accountExists(
    chainId: SolanaChainId,
    address: SolanaAccountAddress | SolanaATAAddress | SolanaMintAddress,
  ): Promise<boolean> {
    const result = await this.rpcCall<{
      value: { data: unknown } | null;
    }>(chainId, "getAccountInfo", [
      String(address),
      { encoding: "base64", commitment: "confirmed" },
    ]);
    return result.value != null;
  }

  async getMintTokenProgram(
    chainId: SolanaChainId,
    mint: SolanaMintAddress,
  ): Promise<SolanaProgramAddress> {
    const result = await this.rpcCall<{
      value: { owner: string } | null;
    }>(chainId, "getAccountInfo", [
      String(mint),
      { encoding: "base64", commitment: "confirmed" },
    ]);
    if (!result.value?.owner) {
      throw new Error(`Mint account not found: ${mint}`);
    }
    return SolanaAddressUtils.asProgramAddress(result.value.owner);
  }

  async getTokenAccountBalance(
    chainId: SolanaChainId,
    tokenAccount: SolanaATAAddress,
  ): Promise<ISolanaTokenAccountBalance> {
    const result = await this.rpcCall<{
      value: { amount: string; decimals: number };
    }>(chainId, "getTokenAccountBalance", [
      String(tokenAccount),
      { commitment: "confirmed" },
    ]);
    return {
      amount: BigInt(result.value.amount),
      decimals: result.value.decimals,
    };
  }

  async getSignaturesForAddress(
    chainId: SolanaChainId,
    address: SolanaAccountAddress | SolanaATAAddress,
    limit: number,
  ): Promise<ISolanaSignatureInfo[]> {
    const rows = await this.rpcCall<
      Array<{
        signature?: string;
        blockTime?: number | null;
        err?: unknown;
      }>
    >(chainId, "getSignaturesForAddress", [
      String(address),
      { limit: Math.min(Math.max(limit, 1), 1000), commitment: "confirmed" },
    ]);
    const out: ISolanaSignatureInfo[] = [];
    for (const row of rows ?? []) {
      if (!row.signature) continue;
      out.push({
        signature: SolanaTransactionHash(row.signature),
        blockTime:
          typeof row.blockTime === "number" && Number.isFinite(row.blockTime)
            ? row.blockTime
            : null,
        err: row.err ?? null,
      });
    }
    return out;
  }

  async getParsedTransaction(
    chainId: SolanaChainId,
    signature: SolanaTransactionHash,
  ): Promise<ISolanaParsedTransaction | null> {
    const result = await this.rpcCall<{
      blockTime?: number | null;
      meta?: {
        err?: unknown;
        preTokenBalances?: unknown[];
        postTokenBalances?: unknown[];
      } | null;
      transaction?: {
        message?: {
          accountKeys?: Array<string | { pubkey?: string }>;
        };
      };
    } | null>(chainId, "getTransaction", [
      String(signature),
      {
        encoding: "jsonParsed",
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      },
    ]);
    if (!result) {
      return null;
    }
    const accountKeys = (result.transaction?.message?.accountKeys ?? []).map(
      (key) => (typeof key === "string" ? key : (key.pubkey ?? null)),
    );
    return {
      signature,
      blockTime:
        typeof result.blockTime === "number" && Number.isFinite(result.blockTime)
          ? result.blockTime
          : null,
      err: result.meta?.err ?? null,
      preTokenBalances: this.parseTokenBalances(
        result.meta?.preTokenBalances,
        accountKeys,
      ),
      postTokenBalances: this.parseTokenBalances(
        result.meta?.postTokenBalances,
        accountKeys,
      ),
    };
  }

  protected async rpcUrl(chainId: SolanaChainId): Promise<string> {
    const chain = await this.chainRepository.get(chainId);
    if (!chain?.rpcUrl) {
      throw new Error(`No Solana RPC URL configured for ${chainId}`);
    }
    return chain.rpcUrl;
  }

  protected async rpcCall<T>(
    chainId: SolanaChainId,
    method: string,
    params: unknown[],
  ): Promise<T> {
    const response = await fetch(await this.rpcUrl(chainId), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
    });
    if (!response.ok) {
      throw new Error(
        `Solana RPC HTTP ${response.status} for ${method} on ${chainId}`,
      );
    }
    const body = (await response.json()) as IJsonRpcResponse<T>;
    if (body.error) {
      throw new Error(
        body.error.message ?? `Solana RPC error for ${method}`,
      );
    }
    if (body.result === undefined) {
      throw new Error(`Solana RPC missing result for ${method}`);
    }
    return body.result;
  }

  protected parseTokenBalances(
    rows: unknown[] | undefined,
    accountKeys: Array<string | null>,
  ): ISolanaParsedTokenBalance[] {
    if (!Array.isArray(rows)) {
      return [];
    }
    const out: ISolanaParsedTokenBalance[] = [];
    for (const item of rows) {
      if (!item || typeof item !== "object") continue;
      const row = item as {
        accountIndex?: number;
        mint?: string;
        owner?: string;
        uiTokenAmount?: { amount?: string; decimals?: number };
      };
      if (
        typeof row.accountIndex !== "number" ||
        typeof row.mint !== "string" ||
        !row.uiTokenAmount?.amount
      ) {
        continue;
      }
      let amount: bigint;
      try {
        amount = BigInt(row.uiTokenAmount.amount);
      } catch {
        continue;
      }
      const decimals = Number(row.uiTokenAmount.decimals ?? 0);
      out.push({
        accountIndex: row.accountIndex,
        mint: row.mint,
        owner: typeof row.owner === "string" ? row.owner : null,
        amount,
        decimals: Number.isFinite(decimals) ? decimals : 0,
        accountAddress: accountKeys[row.accountIndex] ?? null,
      });
    }
    return out;
  }
}
