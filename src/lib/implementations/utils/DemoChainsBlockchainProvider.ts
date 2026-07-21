import { createPublicClient, http, type PublicClient } from "viem";
import type { EVMChainId } from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import { DEMO_CHAINS } from "../../../ows/demoChains";

/** Caches viem public clients keyed by demo-chain id. */
export class DemoChainsBlockchainProvider implements IBlockchainProvider {
  private readonly clients = new Map<EVMChainId, PublicClient>();

  getPublicClient(chainId: EVMChainId): PublicClient {
    const cached = this.clients.get(chainId);
    if (cached) return cached;

    const chain = DEMO_CHAINS.find((entry) => entry.chainId === chainId);
    if (!chain) {
      throw new Error(`Unsupported chain for RPC: ${chainId}`);
    }

    const client = createPublicClient({
      transport: http(chain.rpcUrl),
    });
    this.clients.set(chainId, client);
    return client;
  }
}
