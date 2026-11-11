import type { ReactNode } from "react";

export function AssetActionButton({
  label,
  variant,
  children,
  disabled = false,
  onClick,
}: {
  label: string;
  variant: "primary" | "outline";
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        disabled={disabled}
        aria-label={label}
        onClick={onClick}
        className={
          variant === "primary"
            ? "bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-full opacity-90 disabled:opacity-50"
            : "border-border bg-background text-foreground flex size-12 items-center justify-center rounded-full border disabled:opacity-50"
        }
      >
        {children}
      </button>
      <span
        className={`text-xs font-medium ${
          variant === "primary" ? "text-primary" : "text-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
