import { ArrowRightLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SwapNetworkPrompt({
  currentNetworkLabel,
  targetNetworkLabel,
  switching,
  error,
  onSwitch,
}: {
  currentNetworkLabel: string;
  targetNetworkLabel: string;
  switching: boolean;
  error: string | null;
  onSwitch: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="swap-network-prompt-title"
      aria-describedby="swap-network-prompt-description"
      className="w-full max-w-[420px] rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <ArrowRightLeft className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            id="swap-network-prompt-title"
            className="text-sm font-semibold text-amber-950"
          >
            Switch network to swap
          </h3>
          <p
            id="swap-network-prompt-description"
            className="mt-1 text-sm leading-relaxed text-amber-900/80"
          >
            Your wallet is on <strong>{currentNetworkLabel}</strong>. Swaps run
            on <strong>{targetNetworkLabel}</strong> mainnet — switch networks
            to continue.
          </p>
          {error ? (
            <p className="mt-2 text-xs text-red-600">{error}</p>
          ) : null}
          <Button
            type="button"
            className="mt-3 bg-amber-700 text-white hover:bg-amber-800"
            disabled={switching}
            onClick={onSwitch}
          >
            {switching ? "Switching…" : `Switch to ${targetNetworkLabel}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
