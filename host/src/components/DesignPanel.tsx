import { WalletConfigurator } from "./WalletConfigurator";

export interface IDesignPanelProps {
  ready: boolean;
  onApplyStyle: (options: Record<string, unknown>) => Promise<void>;
}

/**
 * Design mode: configurator (left) + live wallet preview region (right).
 * The branding iframe is kept visible via {@link OWSProxy.showWallet}.
 */
export function DesignPanel({ ready, onApplyStyle }: IDesignPanelProps) {
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
              Live Branding Layer flyout (lower-right). Changes apply via{" "}
              <code className="text-xs">setStyle</code>.
            </p>
          </div>
          <span className="bg-accent text-accent-foreground inline-flex items-center rounded-full border border-cyan-100 px-2.5 py-1 text-xs font-semibold">
            Design mode
          </span>
        </div>

        <div className="border-primary/30 relative flex flex-1 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-white shadow-sm">
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-9 items-center gap-1.5 border-b border-slate-100 bg-slate-50/90 px-3">
            <span className="size-2.5 rounded-full bg-red-300" />
            <span className="size-2.5 rounded-full bg-amber-300" />
            <span className="size-2.5 rounded-full bg-emerald-300" />
            <span className="text-muted-foreground ml-2 text-xs">
              Host canvas
            </span>
          </div>
          <p className="text-muted-foreground max-w-xs px-6 text-center text-sm">
            {ready
              ? "Wallet flyout is open. Apply styles from the left panel to preview them."
              : "Connecting to wallet…"}
          </p>
        </div>
      </section>
    </div>
  );
}
