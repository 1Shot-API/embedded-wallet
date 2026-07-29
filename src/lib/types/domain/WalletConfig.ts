/**
 * Runtime configuration for the 1Shot Branding Layer wallet.
 * Built by {@link ConfigProvider} (relayer URL from the iframe host, etc.).
 */
export class WalletConfig {
  public constructor(
    /** Origin for credential + activity REST (no trailing slash). */
    public readonly relayerBaseUrl: string,
    /** localStorage key for optimistic send history. */
    public readonly assetActivityStorageKey: string,
    /** localStorage key for user-tracked assets. */
    public readonly trackedAssetsStorageKey: string,
    /** localStorage key for the plaintext credentials cache. */
    public readonly credentialsStorageKey: string,
    /** Default page size when listing asset activity. */
    public readonly assetActivityDefaultLimit: number,
    /** Max optimistic send rows retained in localStorage. */
    public readonly assetActivityMaxOptimistic: number,
    /**
     * Circle onramp widget origin (must match Relayer `ONRAMP_WIDGET_BASE_URL`).
     */
    public readonly onrampWidgetBaseUrl: string,
  ) {}
}
