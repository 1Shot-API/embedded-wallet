import type { ISwapToken } from "@/constants/swapTokens";
import { cn } from "@/lib/utils";

function TokenIcon({
  logoURI,
  symbol,
}: {
  logoURI?: string;
  symbol?: string;
}) {
  if (logoURI) {
    return (
      <img
        src={logoURI}
        alt={symbol ?? "Token"}
        className="size-8 shrink-0 rounded-full bg-neutral-100 object-cover"
      />
    );
  }

  return <div className="size-8 shrink-0 rounded-full bg-neutral-200" aria-hidden />;
}

export function SwapAmountField({
  token,
  amount,
  amountError,
  disabled,
  onAmountChange,
}: {
  token: ISwapToken | undefined;
  amount: string;
  amountError: string | null;
  disabled?: boolean;
  onAmountChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-3">
      <p className="mb-2 text-xs text-neutral-500">Send</p>
      <div className="flex items-center gap-3">
        <TokenIcon logoURI={token?.logoURI} symbol={token?.symbol} />
        <div className="min-w-0 flex-1">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder="0"
            disabled={disabled || !token}
            value={amount}
            onChange={(event) => onAmountChange(event.target.value)}
            className={cn(
              "w-full border-0 bg-transparent p-0 text-3xl font-medium text-neutral-900 outline-none placeholder:text-neutral-300",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          />
          <p className="mt-0.5 text-sm text-neutral-400">—</p>
        </div>
      </div>
      {amountError ? (
        <p className="mt-2 text-xs text-red-600">{amountError}</p>
      ) : null}
    </div>
  );
}

export function SwapReceivePreview({
  quoting,
  quoteError,
  receiveAmount,
  receiveSymbol,
  minReceiveAmount,
  routeTool,
}: {
  quoting: boolean;
  quoteError: string | null;
  receiveAmount: string | null;
  receiveSymbol: string | null;
  minReceiveAmount: string | null;
  routeTool?: string;
}) {
  const showPreview =
    quoting || quoteError != null || receiveAmount != null;

  if (!showPreview) {
    return null;
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <p className="mb-2 text-xs text-neutral-500">Receive</p>
      {quoting ? (
        <p className="text-sm text-neutral-500">Fetching quote…</p>
      ) : quoteError ? (
        <p className="text-sm text-red-600">{quoteError}</p>
      ) : receiveAmount && receiveSymbol ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-medium text-neutral-900">
            {receiveAmount}{" "}
            <span className="text-base font-normal text-neutral-600">
              {receiveSymbol}
            </span>
          </p>
          {minReceiveAmount ? (
            <p className="text-xs text-neutral-500">
              Min. {minReceiveAmount} {receiveSymbol}
            </p>
          ) : null}
          {routeTool ? (
            <p className="text-xs text-neutral-500">Route: {routeTool}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
