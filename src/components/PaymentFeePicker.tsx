import { useEffect, useRef, useState } from "react";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { formatUnits } from "viem";
import type { IPaymentQuote, IPaymentTokenOption } from "../lib/interfaces/business";
import { useWallet } from "../wallet/WalletProvider";
import { AssetIcon } from "./AssetIcon";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export interface IPaymentFeePickerProps {
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  quote: IPaymentQuote | null;
  error: string | null;
  loading: boolean;
  onQuoteChange: (quote: IPaymentQuote | null, error: string | null) => void;
}

function findSelectedToken(
  quote: IPaymentQuote,
): IPaymentTokenOption | undefined {
  return quote.tokens.find(
    (token) =>
      String(token.address).toLowerCase() ===
      String(quote.selectedToken).toLowerCase(),
  );
}

function PaymentTokenRow({
  chainId,
  token,
}: {
  chainId: EVMChainId;
  token: IPaymentTokenOption;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AssetIcon
        chainId={chainId}
        address={token.address}
        symbol={token.symbol}
        size="sm"
      />
      <span>{token.symbol}</span>
      <span className="text-muted-foreground">
        ({formatUnits(token.balance, token.decimals)})
      </span>
    </span>
  );
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
  useEffect(() => {
    onQuoteChangeRef.current = onQuoteChange;
  }, [onQuoteChange]);

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
  const selectedToken = quote ? findSelectedToken(quote) : undefined;

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
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span>Est. fee:</span>
            <span className="inline-flex items-center gap-1.5 font-medium">
              {quote.feeFormatted}
              {selectedToken ? (
                <>
                  <AssetIcon
                    chainId={chainId}
                    address={selectedToken.address}
                    symbol={selectedToken.symbol}
                    size="sm"
                  />
                  {selectedToken.symbol}
                </>
              ) : (
                "TOKEN"
              )}
            </span>
            <span className="text-muted-foreground">(finalized on submit)</span>
          </p>
          <div className="text-muted-foreground flex flex-col gap-1 text-[0.8rem]">
            <span>Pay with</span>
            <Select
              value={String(quote.selectedToken)}
              disabled={isLoading}
              onValueChange={(value) => {
                void onSelectToken(value as EVMAccountAddress);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select payment token">
                  {selectedToken ? (
                    <PaymentTokenRow chainId={chainId} token={selectedToken} />
                  ) : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="z-[10001]">
                {quote.tokens.map((token) => (
                  <SelectItem
                    key={String(token.address)}
                    value={String(token.address)}
                    disabled={token.balance <= 0n}
                  >
                    <PaymentTokenRow chainId={chainId} token={token} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      ) : null}
    </div>
  );
}
