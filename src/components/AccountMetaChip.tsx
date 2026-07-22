import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface IAccountMetaChipProps {
  icon: ReactNode;
  value: string;
  title?: string;
  ariaLabel: string;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Compact bordered account-row control: icon + single truncated value.
 */
export function AccountMetaChip({
  icon,
  value,
  title,
  ariaLabel,
  disabled = false,
  onClick,
}: IAccountMetaChipProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title ?? value}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border-border bg-background hover:bg-muted/40 flex min-w-0 items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors",
        "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50",
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
        {icon}
      </span>
      <span className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
        {value}
      </span>
    </button>
  );
}
