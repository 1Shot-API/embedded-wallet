import type { AppKit } from "@crcl-main/app-kit";

/**
 * Utility-level Circle AppKit lifecycle. Lazily constructs a single AppKit and
 * exposes its onramp handle for OnrampView.
 */
export interface ICircleProvider {
  getOnramp(): Promise<AppKit["onramp"]>;
  /** Relayer session mint URL (`POST /wallet/onramp`). */
  getSessionUrl(): Promise<string>;
}

export const ICircleProviderType = Symbol.for("ICircleProvider");
