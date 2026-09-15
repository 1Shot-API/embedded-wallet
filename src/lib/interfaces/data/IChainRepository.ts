import type { EVMAccountAddress, EVMChainId, OWSChainId } from "@1shotapi/ows-types";
import type { SupportedChain } from "../../types/domain/SupportedChain";

export interface IChainRepository {
  /** Enabled catalog rows, filtered by the current `allowedChains` allowlist. */
  list(): Promise<SupportedChain[]>;

  get(chainId: OWSChainId): Promise<SupportedChain | null>;

  /**
   * Restrict the Network dropdown / RpcHelper surface.
   * `null` or empty ⇒ all catalog-enabled chains.
   */
  setAllowedChains(chainIds: OWSChainId[] | null): void;

  /** Subscribe to allowlist (and thus `list()`) changes. Returns unsubscribe. */
  onAllowedChainsChanged(handler: () => void): () => void;

  /** Full catalog (not filtered by allowlist), for RPC / configure validation. */
  getCatalog(): readonly SupportedChain[];

  /**
   * Cached EIP-7702 upgrade status for an account on a chain
   * (`oneshot.walletUpgraded.{chainId}.{address}`). Per-chain — never global.
   * `null` ⇒ no localStorage entry.
   *
   * Callers that decide whether to sign an authorization must still verify
   * with `getCode`; this cache is a hint / last-known value only.
   */
  getWalletUpgraded(
    chainId: EVMChainId,
    address: EVMAccountAddress,
  ): Promise<boolean | null>;

  setWalletUpgraded(
    chainId: EVMChainId,
    address: EVMAccountAddress,
    upgraded: boolean,
  ): Promise<void>;
}

export const IChainRepositoryType = Symbol.for("IChainRepository");
