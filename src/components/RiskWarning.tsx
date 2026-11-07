import { TriangleAlertIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Wallet-owned warning box for risk the host introduced.
 *
 * The palette is literal rather than theme tokens, so a host theme cannot
 * blend the warning into the card or make it unreadable; the text inside is
 * one of the wallet-owned strings (`WALLET_OWNED_COPY_PATHS`) or a value the
 * wallet derived itself.
 */
export function RiskWarning({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex gap-2.5 rounded-lg border border-[#e3a008] bg-[#fff4cc] px-3 py-2.5 text-sm leading-relaxed text-[#4a3200] ${className}`}
    >
      <TriangleAlertIcon
        className="mt-0.5 size-4 shrink-0 text-[#9a6b00]"
        aria-hidden
      />
      <div className="min-w-0 flex-1 whitespace-pre-line">{children}</div>
    </div>
  );
}
