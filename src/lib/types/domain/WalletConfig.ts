import type { DomainString, UriString } from "@1shotapi/ows-types";

/**
 * Runtime configuration for the 1Shot Branding Layer wallet.
 * Built by {@link ConfigProvider} (relayer URL from the iframe host, etc.).
 */
export class WalletConfig {
  public constructor(
    /** Origin for credential + activity REST (no trailing slash). */
    public readonly relayerBaseUrl: UriString,
    /**
     * Embedding host hostname for analytics (`hostDomain` on OWS events).
     * Resolved once when config is first requested.
     */
    public readonly hostDomain: DomainString,
    /** localStorage key for optimistic send history. */
    public readonly assetActivityStorageKey: string,
    /** localStorage key for user-tracked assets. */
    public readonly trackedAssetsStorageKey: string,
    /**
     * localStorage key for the plaintext vault cache (credentials +
     * delegations + future typed blobs).
     */
    public readonly vaultStorageKey: string,
    /** Default page size when listing asset activity. */
    public readonly assetActivityDefaultLimit: number,
    /** Max optimistic send rows retained in localStorage. */
    public readonly assetActivityMaxOptimistic: number,
  ) {}
}
