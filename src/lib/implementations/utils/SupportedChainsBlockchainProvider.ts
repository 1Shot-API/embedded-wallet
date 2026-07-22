import { createPublicClient, http, type PublicClient } from "viem";
import type { EVMChainId } from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import type { IChainRepository } from "../../interfaces/data/IChainRepository";

/** Caches viem public clients keyed by supported-chain id. */
export class SupportedChainsBlockchainProvider implements IBlockchainProvider {
  private readonly clients = new Map<string, PublicClient>();

  constructor(private readonly chainRepository: IChainRepository) {}

  getPublicClient(chainId: EVMChainId): PublicClient {
    const key = String(chainId).toLowerCase();
    const cached = this.clients.get(key);
    if (cached) return cached;

    const chain =
      this.chainRepository
        .getCatalog()
        .find((entry) => String(entry.chainId).toLowerCase() === key) ?? null;
    if (!chain) {
      throw new Error(`Unsupported chain for RPC: ${chainId}`);
    }

    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });
    this.clients.set(key, client);
    return client;
  }
}
