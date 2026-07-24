import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import { WalletConfig } from "../../types/domain/WalletConfig";

const PRODUCTION_WALLET_HOSTNAME = "wallet.1shotapi.com";
const PRODUCTION_RELAYER_BASE_URL = "https://relayer.1shotapi.com";
const DEVELOPMENT_RELAYER_BASE_URL = "https://relayer.1shotapi.dev";

const DEFAULT_ASSET_ACTIVITY_STORAGE_KEY = "ows.asset-activity.v1";
const DEFAULT_TRACKED_ASSETS_STORAGE_KEY = "ows.tracked-assets.v2";
const DEFAULT_CREDENTIALS_STORAGE_KEY = "ows.credentials.v2";
const DEFAULT_ASSET_ACTIVITY_LIMIT = 10;
const DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC = 100;

const DEFAULT_DISPLAY_CEREMONY_SIZE = { width: 448, height: 520 } as const;
const DEFAULT_DISPLAY_MODAL_SIZE = { width: 420, height: 480 } as const;
const DEFAULT_DISPLAY_BACKUP_SIZE = { width: 480, height: 420 } as const;
const DEFAULT_DISPLAY_COMPACT_SIZE = { width: 420, height: 360 } as const;

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
      DEFAULT_CREDENTIALS_STORAGE_KEY,
      DEFAULT_ASSET_ACTIVITY_LIMIT,
      DEFAULT_ASSET_ACTIVITY_MAX_OPTIMISTIC,
      { ...DEFAULT_DISPLAY_CEREMONY_SIZE },
      { ...DEFAULT_DISPLAY_MODAL_SIZE },
      { ...DEFAULT_DISPLAY_BACKUP_SIZE },
      { ...DEFAULT_DISPLAY_COMPACT_SIZE },
    );
    return this.cached;
  }

  private resolveRelayerBaseUrl(): string {
    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";
    if (hostname === PRODUCTION_WALLET_HOSTNAME) {
      return PRODUCTION_RELAYER_BASE_URL;
    }
    return DEVELOPMENT_RELAYER_BASE_URL;
  }
}
