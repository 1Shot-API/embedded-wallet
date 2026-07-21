import { useId } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ITokenAmountInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  symbol?: string;
  disabled?: boolean;
  error?: string | null;
  className?: string;
}

/** Decimal amount field for token sends (string in / out; parse at submit). */
export function TokenAmountInput({
  value,
  onChange,
  label,
  placeholder = "0.0",
  symbol,
  disabled,
  error,
  className,
}: ITokenAmountInputProps) {
  const id = useId();
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-muted-foreground text-xs font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          className={cn(symbol && "pr-14")}
        />
        {symbol ? (
          <span className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs font-medium">
            {symbol}
          </span>
        ) : null}
      </div>
      {error ? (
        <p className="text-destructive text-xs" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
