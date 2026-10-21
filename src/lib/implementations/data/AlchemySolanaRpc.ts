import {
  SolanaTransactionSignature,
  type SolanaAccountAddress,
  type SolanaChainId,
} from "@1shotapi/ows-types";

import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type {
  ISolanaBlockhash,
  ISolanaRpc,
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
 * Alchemy Solana JSON-RPC (`getBalance`, `getLatestBlockhash`, `sendTransaction`)
 * using the catalog HTTPS URL from {@link IChainRepository}.
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
