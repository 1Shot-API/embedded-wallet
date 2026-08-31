import { useCallback, useEffect, useRef, useState } from "react";
import type { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import { formatUnits } from "viem";
import type { IPaymentQuote, IPaymentTokenOption } from "../lib/interfaces/business";
import { useWallet } from "../wallet/WalletProvider";
import { AssetIcon } from "./AssetIcon";
import { QuoteCountdown } from "./QuoteCountdown";
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
  /** When true, pause the quote countdown (e.g. submit in flight). */
  paused?: boolean;
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
 * Loads payment-token options (USDC preferred) and shows a live fee quote
 * with auto-refresh. Exact fee is settled by `relayer_estimate7710Transaction`
 * at submit.
 */
export function PaymentFeePicker({
  chainId,
  ownerAddress,
  quote,
  error,
  loading,
  paused = false,
  onQuoteChange,
}: IPaymentFeePickerProps) {
  const { transactionService } = useWallet();
  const [preferredToken, setPreferredToken] = useState<
    EVMAccountAddress | undefined
  >(undefined);
  const [selectBusy, setSelectBusy] = useState(false);
  const onQuoteChangeRef = useRef(onQuoteChange);
  useEffect(() => {
    onQuoteChangeRef.current = onQuoteChange;
  }, [onQuoteChange]);

  const getNewQuote = useCallback(async (): Promise<string> => {
    const next = await transactionService.quotePayment(
      chainId,
      ownerAddress,
      preferredToken,
    );
    onQuoteChangeRef.current(next, null);
    return next.feeFormatted;
  }, [chainId, ownerAddress, preferredToken, transactionService]);

  async function onSelectToken(token: EVMAccountAddress): Promise<void> {
    setSelectBusy(true);
    try {
      setPreferredToken(token);
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
      setSelectBusy(false);
    }
  }

  const isLoading = loading || selectBusy;
  const selectedToken = quote ? findSelectedToken(quote) : undefined;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <p className="text-muted-foreground text-[0.8rem] font-medium">
        Network fee (1Shot Relayer)
      </p>
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span>Est. fee:</span>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <QuoteCountdown
            key={preferredToken ? String(preferredToken) : "default"}
            getNewQuote={getNewQuote}
            paused={paused || isLoading}
          />
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
          ) : null}
        </span>
      </p>
      {quote ? (
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
      ) : null}
    </div>
  );
}
