import type {
  IClearSigningEnvironment,
  IClearSigningTokenMetadata,
} from "@1shotapi/ows-clear-signing";
import {
  EVMContractAddress,
  type EVMAccountAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";
import type { IBlockchainProvider } from "@1shotapi/ows-wallet-utils";
import { erc20Abi } from "viem";

import type { IChainRepository } from "../../interfaces/data/IChainRepository";
import type { IKnownAssetRepository } from "../../interfaces/data/IKnownAssetRepository";
import type { ITrackedAssetRepository } from "../../interfaces/data/ITrackedAssetRepository";
import type { SupportedChain } from "../../types/domain/SupportedChain";

const DEFAULT_ONCHAIN_TIMEOUT_MS = 1500;
const FALLBACK_NATIVE: IClearSigningTokenMetadata = {
  symbol: "ETH",
  decimals: 18,
};

export interface ClearSigningEnvironmentOptions {
  /** Budget for an on-chain ERC-20 `symbol()` / `decimals()` read of an unknown token. */
  onchainTimeoutMs?: number;
}

/**
 * Wallet lookups for `ClearSigningFormatter`. Token metadata comes from the user's tracked
 * assets, then the hardcoded catalog, then an on-chain ERC-20 read; every answer (including
 * "unknown") is cached for the session. Nothing here throws — unknown values render raw.
 */
export class ClearSigningEnvironment implements IClearSigningEnvironment {
  private readonly onchainTimeoutMs: number;
  private readonly tokenCache = new Map<
    string,
    Promise<IClearSigningTokenMetadata | null>
  >();

  constructor(
    private readonly chainRepository: IChainRepository,
    private readonly knownAssetRepository: IKnownAssetRepository,
    private readonly trackedAssetRepository: ITrackedAssetRepository,
    private readonly blockchain: IBlockchainProvider,
    options: ClearSigningEnvironmentOptions = {},
  ) {
    this.onchainTimeoutMs =
      options.onchainTimeoutMs ?? DEFAULT_ONCHAIN_TIMEOUT_MS;
  }

  getTokenMetadata(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<IClearSigningTokenMetadata | null> {
    const key = `${chainId}:${address}`.toLowerCase();
    let cached = this.tokenCache.get(key);
    if (!cached) {
      cached = this.resolveTokenMetadata(chainId, address).catch(() => null);
      this.tokenCache.set(key, cached);
    }
    return cached;
  }

  getNativeCurrency(chainId: EVMChainId): IClearSigningTokenMetadata {
    const native = this.chain(chainId)?.nativeCurrency;
    return native
      ? { symbol: native.symbol, decimals: native.decimals }
      : FALLBACK_NATIVE;
  }

  getChainName(chainId: EVMChainId): string | null {
    return this.chain(chainId)?.label ?? null;
  }

  /** Token contracts resolve to their asset name; the wallet has no address book otherwise. */
  async getAddressName(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<string | null> {
    try {
      const asset = await this.localAsset(chainId, EVMContractAddress(address));
      return asset?.name ?? null;
    } catch {
      return null;
    }
  }

  private async resolveTokenMetadata(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<IClearSigningTokenMetadata | null> {
    const local = await this.localAsset(chainId, address);
    if (local) {
      return { symbol: local.symbol, decimals: local.decimals };
    }
    return this.readErc20Metadata(chainId, address);
  }

  private async localAsset(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<{ name: string; symbol: string; decimals: number } | null> {
    const wanted = String(address).toLowerCase();
    const tracked = (await this.trackedAssetRepository.list(chainId)).find(
      (asset) => String(asset.address).toLowerCase() === wanted,
    );
    if (tracked) return tracked;
    return this.knownAssetRepository.getKnownAsset(chainId, address);
  }

  private async readErc20Metadata(
    chainId: EVMChainId,
    address: EVMContractAddress,
  ): Promise<IClearSigningTokenMetadata | null> {
    const client = this.blockchain.getPublicClient(chainId);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), this.onchainTimeoutMs);
    });
    const read = Promise.all([
      client.readContract({ address, abi: erc20Abi, functionName: "symbol" }),
      client.readContract({ address, abi: erc20Abi, functionName: "decimals" }),
    ]).then(([symbol, decimals]) => ({ symbol, decimals: Number(decimals) }));
    try {
      return await Promise.race([read, timeout]);
    } finally {
      clearTimeout(timer);
      // A late rejection after the timeout won the race must not surface as unhandled.
      read.catch(() => undefined);
    }
  }

  private chain(chainId: EVMChainId): SupportedChain | null {
    const wanted = String(chainId).toLowerCase();
    return (
      this.chainRepository
        .getCatalog()
        .find((entry) => String(entry.chainId).toLowerCase() === wanted) ??
      null
    );
  }
}
