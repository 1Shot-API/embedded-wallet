import { createPublicClient, defineChain, http, type PublicClient } from "viem";
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

    const viemChain = defineChain({
      id: Number(BigInt(chain.chainId)),
      name: chain.label,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: {
        default: { http: [chain.rpcUrl] },
      },
      blockExplorers: {
        default: { name: "Explorer", url: chain.blockExplorerUrl },
      },
    });

    const client = createPublicClient({
      chain: viemChain,
      transport: http(chain.rpcUrl),
    });
    this.clients.set(key, client);
    return client;
  }
}
