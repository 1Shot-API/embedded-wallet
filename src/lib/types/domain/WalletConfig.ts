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
    /** IndexedDB cache key for optimistic send history. */
    public readonly assetActivityStorageKey: string,
    /** IndexedDB cache key for user-tracked assets. */
    public readonly trackedAssetsStorageKey: string,
    /**
     * Legacy monolithic vault cache key (`ows.vault.v1`). Kept for one-shot
     * migration into per-item IndexedDB object stores; not written anymore.
     */
    public readonly vaultStorageKey: string,
    /** Default page size when listing asset activity. */
    public readonly assetActivityDefaultLimit: number,
    /** Max optimistic send rows retained in IndexedDB. */
    public readonly assetActivityMaxOptimistic: number,
    /**
     * Circle onramp widget origin (must match Relayer `ONRAMP_WIDGET_BASE_URL`).
     */
    public readonly onrampWidgetBaseUrl: string,
    /** Ankr API key for Bitcoin JSON-RPC + Blockbook (mainnet). */
    public readonly ankrBtcApiKey: string,
  ) {}
}
