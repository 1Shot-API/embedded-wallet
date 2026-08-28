import { AppKit } from "@crcl-main/app-kit";
import type { ICircleProvider } from "../../interfaces/utils/ICircleProvider";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";

/**
 * Lazily constructs Circle {@link AppKit} and caches the onramp handle.
 */
export class CircleProvider implements ICircleProvider {
  private kit: AppKit | null = null;
  private onrampPromise: Promise<AppKit["onramp"]> | null = null;

  constructor(private readonly configProvider: IConfigProvider) {}

  async getOnramp(): Promise<AppKit["onramp"]> {
    if (this.onrampPromise) {
      return this.onrampPromise;
    }
    this.onrampPromise = this.createOnramp();
    try {
      return await this.onrampPromise;
    } catch (error) {
      this.onrampPromise = null;
      this.kit = null;
      throw error;
    }
  }

  async getSessionUrl(): Promise<string> {
    const config = await this.configProvider.getConfig();
    return `${config.relayerBaseUrl.replace(/\/$/, "")}/wallet/onramp`;
  }

  private async createOnramp(): Promise<AppKit["onramp"]> {
    const config = await this.configProvider.getConfig();
    this.kit = new AppKit({
      onramp: {
        widgetBaseUrl: config.onrampWidgetBaseUrl,
      },
    });
    return this.kit.onramp;
  }
}
