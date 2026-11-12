import { CheckCircle2, ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";

function truncateHash(hash: string): string {
  if (hash.length <= 12) {
    return hash;
  }
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

export function SwapSuccessBanner({
  swapHash,
  explorerUrl,
  explorerLabel,
  onDismiss,
  className,
}: {
  swapHash: string;
  explorerUrl: string | null;
  explorerLabel: string;
  onDismiss?: () => void;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-emerald-200 bg-emerald-50 p-4",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <CheckCircle2
          className="mt-0.5 size-6 shrink-0 text-emerald-600"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-emerald-900">
            Swap submitted successfully
          </p>
          <p className="mt-1 text-xs text-emerald-800/80">
            Your transaction was sent to the network.
          </p>
          <p className="mt-2 font-mono text-xs text-emerald-900/70">
            {truncateHash(swapHash)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
              >
                View on {explorerLabel}
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            ) : null}
            {onDismiss ? (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-lg px-3 py-2 text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                New swap
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SwapErrorBanner({
  message,
  className,
}: {
  message: string;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700",
        className,
      )}
    >
      {message}
    </div>
  );
}
