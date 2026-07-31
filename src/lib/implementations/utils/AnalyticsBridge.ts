import type { OWSAnalyticsEvent } from "@1shotapi/ows-types";
import type { IConfigProvider } from "../../interfaces/utils/IConfigProvider";
import type { IEventBus } from "../../interfaces/utils/IEventBus";
import type { IOWSProvider } from "../../interfaces/utils/IOWSProvider";

export type AnalyticsBridgeOptions = {
  eventBus: IEventBus;
  owsProvider: IOWSProvider;
  configProvider: IConfigProvider;
};

/**
 * Dual-sink analytics publisher:
 * 1. Branding→Host via `wallet.analytics.emit` (full rich event)
 * 2. First-party POST `/wallet/product-events` on the relayer (fire-and-forget)
 *
 * Subscribe once after construction; sinks never throw into wallet UX.
 */
export class AnalyticsBridge {
  private started = false;
  private unsubscribe: (() => void) | null = null;

  constructor(private readonly options: AnalyticsBridgeOptions) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.unsubscribe = this.options.eventBus.onAnalytics((event) => {
      void this.publish(event);
    });
  }

  stop(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.started = false;
  }

  private async publish(event: OWSAnalyticsEvent): Promise<void> {
    await Promise.allSettled([
      this.emitToHost(event),
      this.postToRelayer(event),
    ]);
  }

  private async emitToHost(event: OWSAnalyticsEvent): Promise<void> {
    try {
      const wallet = await this.options.owsProvider.getWallet();
      wallet.analytics.emit(event);
    } catch (error: unknown) {
      console.warn("[analytics] host emit failed", error);
    }
  }

  private async postToRelayer(event: OWSAnalyticsEvent): Promise<void> {
    try {
      const config = await this.options.configProvider.getConfig();
      const url = `${String(config.relayerBaseUrl).replace(/\/$/, "")}/wallet/product-events`;
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(event),
        keepalive: true,
      });
      if (!response.ok && response.status !== 404) {
        console.warn("[analytics] relayer ingest HTTP", response.status);
      }
    } catch (error: unknown) {
      // Phase 3 endpoint may not exist yet — fire-and-forget.
      console.warn("[analytics] relayer ingest failed", error);
    }
  }
}
