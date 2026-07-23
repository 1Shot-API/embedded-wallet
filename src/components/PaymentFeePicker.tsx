import { useEffect, useRef, useState } from "react";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { formatUnits } from "viem";
import { useWallet } from "../wallet/WalletProvider";
import type { IPaymentQuote } from "../lib/interfaces/business";

export interface IPaymentFeePickerProps {
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  quote: IPaymentQuote | null;
  error: string | null;
  loading: boolean;
  onQuoteChange: (quote: IPaymentQuote | null, error: string | null) => void;
}

/**
 * Loads payment-token options (USDC preferred) and shows a mock fee for confirm.
 * Exact fee is settled by `relayer_estimate7710Transaction` at submit.
 */
export function PaymentFeePicker({
  chainId,
  ownerAddress,
  quote,
  error,
  loading,
  onQuoteChange,
}: IPaymentFeePickerProps) {
  const { transactionService } = useWallet();
  const [busy, setBusy] = useState(false);
  const onQuoteChangeRef = useRef(onQuoteChange);
  onQuoteChangeRef.current = onQuoteChange;

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    void transactionService
      .quotePayment(chainId, ownerAddress)
      .then((next) => {
        if (!cancelled) onQuoteChangeRef.current(next, null);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          onQuoteChangeRef.current(
            null,
            err instanceof Error ? err.message : "Failed to quote fee",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [chainId, ownerAddress, transactionService]);

  async function onSelectToken(token: EVMAccountAddress): Promise<void> {
    setBusy(true);
    try {
      const next = await transactionService.quotePayment(
        chainId,
        ownerAddress,
        token,
      );
      onQuoteChange(next, null);
    } catch (err: unknown) {
      onQuoteChange(
        null,
        err instanceof Error ? err.message : "Failed to quote fee",
      );
    } finally {
      setBusy(false);
    }
  }

  const isLoading = loading || busy;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <p className="text-muted-foreground text-[0.8rem] font-medium">
        Network fee (1Shot Relayer)
      </p>
      {isLoading && !quote ? (
        <p className="text-muted-foreground text-sm">Estimating fee…</p>
      ) : null}
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}
      {quote ? (
        <>
          <p className="text-sm">
            Est. fee:{" "}
            <span className="font-medium">
              {quote.feeFormatted}{" "}
              {quote.tokens.find(
                (t) =>
                  String(t.address).toLowerCase() ===
                  String(quote.selectedToken).toLowerCase(),
              )?.symbol ?? "TOKEN"}
            </span>
            <span className="text-muted-foreground"> (finalized on submit)</span>
          </p>
          <label className="text-muted-foreground flex flex-col gap-1 text-[0.8rem]">
            Pay with
            <select
              className="border-input bg-background text-foreground rounded-md border px-2 py-1.5 text-sm"
              value={String(quote.selectedToken)}
              disabled={isLoading}
              onChange={(event) => {
                void onSelectToken(
                  event.target.value as EVMAccountAddress,
                );
              }}
            >
              {quote.tokens.map((token) => (
                <option
                  key={String(token.address)}
                  value={String(token.address)}
                  disabled={token.balance <= 0n}
                >
                  {token.symbol} (
                  {formatUnits(token.balance, token.decimals)})
                </option>
              ))}
            </select>
          </label>
        </>
      ) : null}
    </div>
  );
}
