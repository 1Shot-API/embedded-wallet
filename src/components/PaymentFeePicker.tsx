import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  EVMContractAddress,
  type EVMAccountAddress,
  type EVMChainId,
} from "@1shotapi/ows-types";
import { formatUnits } from "viem";
import type {
  IPaymentQuote,
  IPaymentTokenOption,
  ITransactionWork,
} from "../lib/interfaces/business";
import type { IFinalRelayerFee } from "../lib/types/domain/RelayerSendUi";
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

export type IPaymentFeePickerMode = "estimate" | "final";

export interface IPaymentFeePickerProps {
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  /** ExactCalldata work used for unsigned `relayer_estimate7710Transaction`. */
  work?: ITransactionWork | ITransactionWork[];
  /**
   * Multichain ExactCalldata work — when set, quotes via
   * `quotePaymentMultichain` (one fee across all chains). Overrides `work`.
   */
  workByChain?: readonly {
    chainId: EVMChainId;
    work: ITransactionWork | ITransactionWork[];
  }[];
  quote: IPaymentQuote | null;
  error: string | null;
  loading: boolean;
  /** When true, pause the quote countdown (e.g. submit in flight). */
  paused?: boolean;
  onQuoteChange: (quote: IPaymentQuote | null, error: string | null) => void;
  mode?: IPaymentFeePickerMode;
  /** Relayer-settled fee after the first estimate (mode `final`). */
  finalFee?: IFinalRelayerFee | null;
}

function paymentTokenKey(token: {
  chainId: EVMChainId;
  address: EVMContractAddress;
}): string {
  return `${token.chainId}:${token.address}`;
}

function parsePaymentTokenKey(value: string): {
  chainId: EVMChainId;
  address: EVMContractAddress;
} | null {
  const sep = value.indexOf(":");
  if (sep <= 0) return null;
  return {
    chainId: value.slice(0, sep) as EVMChainId,
    address: EVMContractAddress(value.slice(sep + 1) as `0x${string}`),
  };
}

function findTokenInList(
  tokens: readonly IPaymentTokenOption[],
  address: EVMContractAddress,
  chainId?: EVMChainId,
): IPaymentTokenOption | undefined {
  return tokens.find(
    (token) =>
      (chainId === undefined || token.chainId === chainId) &&
      token.address === address,
  );
}

function PaymentTokenRow({ token }: { token: IPaymentTokenOption }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <AssetIcon
        chainId={token.chainId}
        address={token.address}
        symbol={token.symbol}
        size="sm"
      />
      <span>{token.symbol}</span>
      <span className="text-muted-foreground truncate">
        on {token.chainName}
      </span>
      <span className="text-muted-foreground">
        ({formatUnits(token.balance, token.decimals)})
      </span>
    </span>
  );
}

/**
 * Loads payment-token options (USDC preferred) and shows a live fee quote
 * from unsigned `relayer_estimate7710Transaction`. Use mode `final` after the
 * signed estimate settles the amount at submit.
 *
 * Token options load independently of a successful quote so the Select stays
 * usable when estimate fails (e.g. Arc dust).
 */
export function PaymentFeePicker({
  chainId,
  ownerAddress,
  work,
  workByChain,
  quote,
  error,
  loading,
  paused = false,
  onQuoteChange,
  mode = "estimate",
  finalFee = null,
}: IPaymentFeePickerProps) {
  const { transactionService, paymentTokenUtils } = useWallet();
  const [preferredToken, setPreferredToken] = useState<
    EVMContractAddress | undefined
  >(undefined);
  const [preferredChainId, setPreferredChainId] = useState<
    EVMChainId | undefined
  >(undefined);
  const [tokenOptions, setTokenOptions] = useState<IPaymentTokenOption[]>([]);
  const [selectBusy, setSelectBusy] = useState(false);
  const onQuoteChangeRef = useRef(onQuoteChange);
  useEffect(() => {
    onQuoteChangeRef.current = onQuoteChange;
  }, [onQuoteChange]);

  const executionChainIds = useMemo(() => {
    if (workByChain && workByChain.length > 0) {
      return [...new Set(workByChain.map((g) => g.chainId))];
    }
    return [chainId];
  }, [chainId, workByChain]);

  const workKey = useMemo(() => {
    if (workByChain && workByChain.length > 0) {
      return workByChain
        .map((group) => {
          const items = Array.isArray(group.work) ? group.work : [group.work];
          const body = items
            .map(
              (item) =>
                `${String(item.to)}:${String(item.data || "0x")}:${item.value ?? 0n}`,
            )
            .join("|");
          return `${String(group.chainId)}:${body}`;
        })
        .join(";");
    }
    const items = Array.isArray(work) ? work : work ? [work] : [];
    return items
      .map(
        (item) =>
          `${String(item.to)}:${String(item.data || "0x")}:${item.value ?? 0n}`,
      )
      .join("|");
  }, [work, workByChain]);

  // Load selectable tokens even when estimate fails (quote stays null).
  useEffect(() => {
    let cancelled = false;
    void paymentTokenUtils
      .listPaymentOptions(ownerAddress, executionChainIds)
      .then((options) => {
        if (!cancelled) setTokenOptions(options);
      })
      .catch(() => {
        if (!cancelled) setTokenOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [executionChainIds, ownerAddress, paymentTokenUtils, workKey]);

  // Prefer tokens from a successful quote (fresher balances), else catalog list.
  const displayTokens = useMemo(() => {
    if (quote && quote.tokens.length > 0) return quote.tokens;
    return tokenOptions;
  }, [quote, tokenOptions]);

  const fetchQuote = useCallback(
    async (token?: EVMContractAddress) => {
      if (workByChain && workByChain.length > 0) {
        return transactionService.quotePaymentMultichain(
          ownerAddress,
          workByChain,
          token,
        );
      }
      if (!work) {
        throw new Error("PaymentFeePicker requires work or workByChain");
      }
      return transactionService.quotePayment(
        chainId,
        ownerAddress,
        work,
        token,
      );
    },
    [chainId, ownerAddress, transactionService, work, workByChain],
  );

  const getNewQuote = useCallback(async (): Promise<string> => {
    try {
      const next = await fetchQuote(preferredToken);
      onQuoteChangeRef.current(next, null);
      setTokenOptions(next.tokens);
      return next.feeFormatted;
    } catch (err: unknown) {
      // Keep prior quote.tokens / tokenOptions so Pay with stays usable.
      onQuoteChangeRef.current(
        null,
        err instanceof Error ? err.message : "Failed to quote fee",
      );
      throw err;
    }
  }, [fetchQuote, preferredToken]);

  async function onSelectToken(
    token: EVMContractAddress,
    tokenChainId: EVMChainId,
  ): Promise<void> {
    setSelectBusy(true);
    try {
      setPreferredToken(token);
      setPreferredChainId(tokenChainId);
      const next = await fetchQuote(token);
      onQuoteChange(next, null);
      setTokenOptions(next.tokens);
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
  const isFinal = mode === "final" && finalFee !== null;

  const selectedToken = useMemo(() => {
    if (isFinal && quote && finalFee) {
      return findTokenInList(
        displayTokens,
        finalFee.paymentToken,
        quote.paymentChainId,
      );
    }
    if (quote) {
      return findTokenInList(
        displayTokens,
        quote.selectedToken,
        quote.paymentChainId,
      );
    }
    if (preferredToken) {
      return findTokenInList(displayTokens, preferredToken, preferredChainId);
    }
    return undefined;
  }, [
    displayTokens,
    finalFee,
    isFinal,
    preferredChainId,
    preferredToken,
    quote,
  ]);

  const feeLabel = isFinal ? "Final fee:" : "Est. fee:";
  const feeDisplay = isFinal ? finalFee.feeFormatted : null;
  const selectValue = selectedToken
    ? paymentTokenKey(selectedToken)
    : quote
      ? paymentTokenKey({
          chainId: quote.paymentChainId,
          address: quote.selectedToken,
        })
      : preferredToken && preferredChainId
        ? paymentTokenKey({
            chainId: preferredChainId,
            address: preferredToken,
          })
        : "";

  const showTokenSelect = !isFinal && displayTokens.length > 0;
  const paidOnLabel =
    selectedToken && selectedToken.chainId !== chainId
      ? selectedToken.chainName
      : quote && quote.paymentChainId !== chainId
        ? quote.paymentChainName
        : null;

  return (
    <div className="mt-4 flex flex-col gap-2 border-t pt-3">
      <p className="text-muted-foreground text-[0.8rem] font-medium">
        Network fee (1Shot Relayer)
      </p>
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : null}
      {paidOnLabel ? (
        <p className="text-muted-foreground text-[0.8rem]">
          Paid on {paidOnLabel}
        </p>
      ) : null}
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <span>{feeLabel}</span>
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {isFinal ? (
            <span>{feeDisplay}</span>
          ) : (
            <QuoteCountdown
              key={`${preferredToken ? String(preferredToken) : "default"}:${workKey}`}
              getNewQuote={getNewQuote}
              paused={paused || isLoading}
            />
          )}
          {selectedToken ? (
            <>
              <AssetIcon
                chainId={selectedToken.chainId}
                address={selectedToken.address}
                symbol={selectedToken.symbol}
                size="sm"
              />
              {selectedToken.symbol}
            </>
          ) : null}
        </span>
      </p>
      {showTokenSelect ? (
        <div className="text-muted-foreground flex flex-col gap-1 text-[0.8rem]">
          <span>Pay with</span>
          <Select
            value={selectValue || undefined}
            disabled={isLoading}
            onValueChange={(value) => {
              const parsed = parsePaymentTokenKey(value);
              if (!parsed) return;
              void onSelectToken(parsed.address, parsed.chainId);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payment token">
                {selectedToken ? <PaymentTokenRow token={selectedToken} /> : null}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="z-[10001]">
              {displayTokens.map((token) => (
                <SelectItem
                  key={paymentTokenKey(token)}
                  value={paymentTokenKey(token)}
                  disabled={token.balance <= 0n}
                >
                  <PaymentTokenRow token={token} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : isFinal && selectedToken ? (
        <div className="text-muted-foreground text-[0.8rem]">
          <span>
            Pay with {selectedToken.symbol} on {selectedToken.chainName}
          </span>
        </div>
      ) : null}
    </div>
  );
}
