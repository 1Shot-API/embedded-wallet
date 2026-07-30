import { UriString } from "@1shotapi/ows-types";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import { WalletConfig } from "../../types/domain/WalletConfig";

const PRODUCTION_WALLET_HOSTNAME = "wallet.1shotapi.com";
const PRODUCTION_RELAYER_BASE_URL = UriString("https://relayer.1shotapi.com");
const DEVELOPMENT_RELAYER_BASE_URL = UriString("https://relayer.1shotapi.dev");

const DEFAULT_ASSET_ACTIVITY_STORAGE_KEY = "ows.asset-activity.v1";
const DEFAULT_TRACKED_ASSETS_STORAGE_KEY = "ows.tracked-assets.v2";
const DEFAULT_VAULT_STORAGE_KEY = "ows.vault.v1";
const DEFAULT_ASSET_ACTIVITY_LIMIT = 10;
const DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC = 100;

/**
 * Resolves {@link WalletConfig} from the Branding Layer iframe host.
 * Production wallet host → production relayer; all other hosts → dev relayer.
 */
export class ConfigProvider implements IConfigProvider {
  private cached: WalletConfig | null = null;

  async getConfig(): Promise<WalletConfig> {
    if (this.cached) {
      return this.cached;
    }

    this.cached = new WalletConfig(
      this.resolveRelayerBaseUrl(),
      DEFAULT_ASSET_ACTIVITY_STORAGE_KEY,
      DEFAULT_TRACKED_ASSETS_STORAGE_KEY,
      DEFAULT_VAULT_STORAGE_KEY,
      DEFAULT_ASSET_ACTIVITY_LIMIT,
      DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC,
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
}
