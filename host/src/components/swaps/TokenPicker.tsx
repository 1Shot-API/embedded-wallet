import type { ISwapToken } from "@/constants/swapTokens";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function TokenIcon({
  logoURI,
  symbol,
  size = "md",
}: {
  logoURI?: string;
  symbol?: string;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "size-6" : "size-8";

  if (logoURI) {
    return (
      <img
        src={logoURI}
        alt={symbol ?? "Token"}
        className={cn(sizeClass, "rounded-full bg-neutral-100 object-cover")}
      />
    );
  }

  return (
    <div
      className={cn(
        sizeClass,
        "rounded-full bg-neutral-200",
      )}
      aria-hidden
    />
  );
}

export function TokenPicker({
  label,
  token,
  tokens,
  chainLogo,
  disabled,
  onSelect,
}: {
  label: string;
  token: ISwapToken | undefined;
  tokens: ISwapToken[];
  chainLogo?: string;
  disabled?: boolean;
  onSelect: (address: string) => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          className={cn(
            "flex min-h-[72px] w-full flex-col justify-center rounded-xl border border-neutral-200 bg-white p-3 text-left transition-colors",
            "hover:border-neutral-300 focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20 focus-visible:outline-none",
            disabled && "cursor-not-allowed opacity-50",
          )}
        >
          <span className="mb-2 text-xs text-neutral-500">{label}</span>
          <div className="flex items-center gap-2">
            <div className="relative shrink-0">
              <TokenIcon logoURI={token?.logoURI} symbol={token?.symbol} />
              {chainLogo ? (
                <img
                  src={chainLogo}
                  alt=""
                  className="absolute -right-1 -bottom-1 size-4 rounded-full border border-white bg-white object-cover"
                />
              ) : null}
            </div>
            <span className="truncate text-sm font-medium text-neutral-900">
              {token?.symbol ?? "Select…"}
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-1.5">
        <ul className="flex flex-col gap-0.5">
          {tokens.map((entry) => (
            <li key={entry.address}>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100",
                  token?.address.toLowerCase() === entry.address.toLowerCase() &&
                    "bg-neutral-100 font-medium",
                )}
                onClick={() => onSelect(entry.address)}
              >
                <TokenIcon logoURI={entry.logoURI} symbol={entry.symbol} size="sm" />
                <span>{entry.symbol}</span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
