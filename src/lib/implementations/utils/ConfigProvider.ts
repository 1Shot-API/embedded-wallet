import { DomainString, UriString } from "@1shotapi/ows-types";

import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IHostOriginProvider } from "../../interfaces/utils/IHostOriginProvider";
import { WalletConfig } from "../../types/domain/WalletConfig";

const PRODUCTION_WALLET_HOSTNAME = "wallet.1shotapi.com";
const PRODUCTION_RELAYER_BASE_URL = UriString("https://relayer.1shotapi.com");
const DEVELOPMENT_RELAYER_BASE_URL = UriString("https://relayer.1shotapi.dev");

const DEFAULT_ASSET_ACTIVITY_STORAGE_KEY = "ows.asset-activity.v1";
const DEFAULT_TRACKED_ASSETS_STORAGE_KEY = "ows.tracked-assets.v2";
const DEFAULT_VAULT_STORAGE_KEY = "ows.vault.v1";
const DEFAULT_ASSET_ACTIVITY_LIMIT = 10;
const DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC = 100;
const DEFAULT_ONRAMP_WIDGET_BASE_URL =
  "https://onramp.arc.io/launch/onramp/v1";
const DEFAULT_ANKR_BTC_API_KEY =
  "979d229c5760954e62206cc809fe7801c1d6a5c1d590af7634dac7e0a4fadbf2";

/**
 * Resolves {@link WalletConfig} from the Branding Layer iframe host.
 * Production wallet host → production relayer; all other hosts → dev relayer.
 */
export class ConfigProvider implements IConfigProvider {
  private cached: WalletConfig | null = null;

  constructor(private readonly hostOriginProvider: IHostOriginProvider) {}

  async getConfig(): Promise<WalletConfig> {
    const hostDomain = this.resolveHostDomain();
    if (this.cached && this.cached.hostDomain === hostDomain) {
      return this.cached;
    }

    this.cached = new WalletConfig(
      this.resolveRelayerBaseUrl(),
      hostDomain,
      DEFAULT_ASSET_ACTIVITY_STORAGE_KEY,
      DEFAULT_TRACKED_ASSETS_STORAGE_KEY,
      DEFAULT_VAULT_STORAGE_KEY,
      DEFAULT_ASSET_ACTIVITY_LIMIT,
      DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC,
      DEFAULT_ONRAMP_WIDGET_BASE_URL,
      DEFAULT_ANKR_BTC_API_KEY,
    );
    return this.cached;
  }

  private resolveRelayerBaseUrl(): UriString {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    if (hostname === PRODUCTION_WALLET_HOSTNAME) {
      return PRODUCTION_RELAYER_BASE_URL;
    }
    return DEVELOPMENT_RELAYER_BASE_URL;
  }

  /**
   * Embedding host hostname for analytics `hostDomain` and host-scoped checks
   * (e.g. `requestCancelDelegations`). Taken from the browser-attested
   * handshake origin; falls back to this wallet's own hostname only before a
   * host has connected or when Branding runs top-level.
   */
  private resolveHostDomain(): DomainString {
    const fromHost = this.hostOriginProvider.getHostDomain();
    if (fromHost) {
      return fromHost;
    }
    if (typeof window === "undefined") {
      return DomainString("localhost");
    }
    return DomainString(window.location.hostname || "localhost");
  }
}
