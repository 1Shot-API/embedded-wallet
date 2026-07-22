import type { EVMChainId } from "@1shotapi/ows-types";
import type { SupportedChain } from "../../types/domain/SupportedChain";

export interface IChainRepository {
  /** Enabled catalog rows, filtered by the current `allowedChains` allowlist. */
  list(): Promise<SupportedChain[]>;

  get(chainId: EVMChainId): Promise<SupportedChain | null>;

  /**
   * Restrict the Network dropdown / RpcHelper surface.
   * `null` or empty ⇒ all catalog-enabled chains.
   */
  setAllowedChains(chainIds: EVMChainId[] | null): void;

  /** Subscribe to allowlist (and thus `list()`) changes. Returns unsubscribe. */
  onAllowedChainsChanged(handler: () => void): () => void;

  /** Full catalog (not filtered by allowlist), for RPC / setStyle validation. */
  getCatalog(): readonly SupportedChain[];
}

export const IChainRepositoryType = Symbol.for("IChainRepository");
