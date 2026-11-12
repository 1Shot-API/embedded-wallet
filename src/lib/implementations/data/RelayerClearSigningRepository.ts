import {
  ClearSigningLookupResultSchema,
  type IClearSigningCalldataLookupKey,
  type IClearSigningEip712LookupKey,
  type IClearSigningLookupFound,
} from "@1shotapi/ows-types";

import type { IClearSigningRepository } from "../../interfaces/data/IClearSigningRepository";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";

const DEFAULT_TIMEOUT_MS = 2000;
const DEFAULT_CACHE_LIMIT = 128;

export interface RelayerClearSigningRepositoryOptions {
  /** Abort a lookup after this long; the consent modal then opens with the generic display. */
  timeoutMs?: number;
  /** Max lookups (hits and misses) remembered for the session. */
  cacheLimit?: number;
}

/** Thrown internally for failures that must not be cached (network, timeout, 5xx, bad body). */
class TransientLookupError extends Error {}

/**
 * {@link IClearSigningRepository} over the relayer REST API (`WalletConfig.relayerBaseUrl`).
 *
 * Definitive answers (found / not found) are kept in a session LRU; concurrent lookups for the
 * same key share one request. Transient failures resolve to `null` but are not cached, so the
 * next request for that key tries again.
 */
export class RelayerClearSigningRepository implements IClearSigningRepository {
  private readonly timeoutMs: number;
  private readonly cacheLimit: number;
  private readonly cache = new Map<
    string,
    Promise<IClearSigningLookupFound | null>
  >();

  constructor(
    private readonly configProvider: IConfigProvider,
    options: RelayerClearSigningRepositoryOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.cacheLimit = options.cacheLimit ?? DEFAULT_CACHE_LIMIT;
  }

  lookupCalldata(
    key: IClearSigningCalldataLookupKey,
  ): Promise<IClearSigningLookupFound | null> {
    return this.lookup("calldata", {
      chainId: key.chainId,
      address: key.address,
      selector: key.selector,
    });
  }

  lookupEip712(
    key: IClearSigningEip712LookupKey,
  ): Promise<IClearSigningLookupFound | null> {
    return this.lookup("eip712", {
      chainId: key.chainId,
      verifyingContract: key.verifyingContract,
      primaryType: key.primaryType,
      encodeTypeHash: key.encodeTypeHash,
    });
  }

  private lookup(
    kind: "calldata" | "eip712",
    params: Record<string, string>,
  ): Promise<IClearSigningLookupFound | null> {
    const query = new URLSearchParams(params).toString();
    const cacheKey = `${kind}?${query.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      // Refresh recency.
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached;
    }

    const pending = this.fetchLookup(kind, query).catch((error: unknown) => {
      if (this.cache.get(cacheKey) === pending) {
        this.cache.delete(cacheKey);
      }
      console.warn(
        `[clear-signing] ${kind} lookup failed; using generic display`,
        error,
      );
      return null;
    });
    this.cache.set(cacheKey, pending);
    while (this.cache.size > this.cacheLimit) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) break;
      this.cache.delete(oldest);
    }
    return pending;
  }

  private async fetchLookup(
    kind: "calldata" | "eip712",
    query: string,
  ): Promise<IClearSigningLookupFound | null> {
    const { relayerBaseUrl } = await this.configProvider.getConfig();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let body: unknown;
    try {
      const response = await fetch(
        `${relayerBaseUrl}/clear-signing/${kind}?${query}`,
        { method: "GET", signal: controller.signal },
      );
      if (!response.ok) {
        throw new TransientLookupError(`HTTP ${response.status}`);
      }
      body = await response.json();
    } catch (error: unknown) {
      throw error instanceof TransientLookupError
        ? error
        : new TransientLookupError(
            error instanceof Error ? error.message : String(error),
          );
    } finally {
      clearTimeout(timer);
    }

    const parsed = ClearSigningLookupResultSchema.safeParse(body);
    if (!parsed.success) {
      throw new TransientLookupError(
        `Malformed response: ${parsed.error.issues[0]?.message ?? "invalid"}`,
      );
    }
    return parsed.data.found ? parsed.data : null;
  }
}
