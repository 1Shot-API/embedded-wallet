import type { RefCallback } from "react";
import { WalletConfigurator } from "./WalletConfigurator";

export interface IDesignPanelProps {
  ready: boolean;
  onApplyStyle: (options: Record<string, unknown>) => Promise<void>;
  /** Create() container for inline OWSProxy (never reparent the iframe). */
  previewMountRef: RefCallback<HTMLDivElement>;
}

/**
 * Design mode: configurator (left) + live inline wallet preview (right).
 * Host destroys/recreates the proxy into this mount with presentationMode=inline.
 */
export function DesignPanel({
  ready,
  onApplyStyle,
  previewMountRef,
}: IDesignPanelProps) {
  return (
    <div className="grid h-[calc(100svh-3.5rem)] grid-cols-1 lg:grid-cols-[minmax(22rem,26rem)_1fr]">
      <aside className="border-border bg-background overflow-y-auto border-r">
        <div className="border-border border-b px-5 py-4">
          <h2 className="font-heading text-lg font-bold tracking-tight">
            Configure
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Tune copy and theme for the Branding Layer.
          </p>
        </div>
        <div className="px-5 py-4">
          <WalletConfigurator ready={ready} onApply={onApplyStyle} />
        </div>
      </aside>

      <section
        className="relative flex min-h-[28rem] flex-col bg-[#f8fafc] p-6"
        aria-label="Wallet preview"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="font-heading text-lg font-bold tracking-tight">
              Preview
            </h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Fresh inline proxy in this slot. Styles are re-applied via{" "}
              <code className="text-xs">configure</code> when you return to Test.
            </p>
          </div>
          <span className="bg-accent text-accent-foreground inline-flex items-center rounded-full border border-cyan-100 px-2.5 py-1 text-xs font-semibold">
            Design mode
          </span>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-auto rounded-2xl border-2 border-dashed border-slate-300/80 bg-white shadow-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50/90 px-3">
            <span className="size-2.5 rounded-full bg-red-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
            <span className="text-muted-foreground ml-2 text-xs">
              Host canvas · inline presentation
            </span>
          </div>

          <div className="flex min-h-[36rem] w-full items-center justify-center px-6 pt-12 pb-8">
            <div
              className="relative h-[600px] w-[360px] shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md"
              aria-label="Wallet inline mount"
            >
              <div ref={previewMountRef} className="absolute inset-0" />
              {!ready ? (
                <p className="text-muted-foreground absolute inset-0 z-20 flex items-center justify-center bg-white/80 px-6 text-center text-sm">
                  Connecting to wallet…
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
