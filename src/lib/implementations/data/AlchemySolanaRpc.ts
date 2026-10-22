import {
  SolanaAddressUtils,
  SolanaTransactionSignature,
  type SolanaAccountAddress,
  type SolanaATAAddress,
  type SolanaChainId,
  type SolanaMintAddress,
  type SolanaProgramAddress,
} from "@1shotapi/ows-types";

import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type {
  ISolanaBlockhash,
  ISolanaRpc,
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
  ): Promise<SolanaTransactionSignature> {
    const signature = await this.rpcCall<string>(chainId, "sendTransaction", [
      wireTransactionBase64,
      {
        encoding: "base64",
        skipPreflight: false,
        preflightCommitment: "confirmed",
      },
    ]);
    return SolanaTransactionSignature(signature);
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
}
