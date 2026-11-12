import { useCallback, useEffect, useRef, useState } from "react";

import { chainIdToNumber } from "@/constants/swapTokens";
import { fetchLifiQuote, type ILifiQuote } from "@/lib/lifiQuote";

const QUOTE_DEBOUNCE_MS = 500;

export interface IUseDebouncedLifiQuoteParams {
  account: string | null;
  selectedChainId: string;
  fromTokenAddress: string;
  toTokenAddress: string;
  parsedAmount: bigint | null;
  enabled: boolean;
}

export function useDebouncedLifiQuote({
  account,
  selectedChainId,
  fromTokenAddress,
  toTokenAddress,
  parsedAmount,
  enabled,
}: IUseDebouncedLifiQuoteParams) {
  const [quote, setQuote] = useState<ILifiQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const inputsValid =
    enabled &&
    Boolean(account) &&
    fromTokenAddress !== "" &&
    toTokenAddress !== "" &&
    fromTokenAddress.toLowerCase() !== toTokenAddress.toLowerCase() &&
    parsedAmount !== null;

  const refreshQuote = useCallback(async (): Promise<ILifiQuote | null> => {
    if (
      !account ||
      !inputsValid ||
      parsedAmount === null ||
      fromTokenAddress === "" ||
      toTokenAddress === ""
    ) {
      setQuote(null);
      setQuoteError(null);
      return null;
    }

    const requestId = ++requestIdRef.current;
    setQuoting(true);
    setQuoteError(null);

    try {
      const numericChainId = chainIdToNumber(selectedChainId);
      const nextQuote = await fetchLifiQuote({
        fromChain: numericChainId,
        toChain: numericChainId,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        fromAmount: parsedAmount.toString(),
        fromAddress: account,
      });

      if (requestId !== requestIdRef.current) {
        return null;
      }

      setQuote(nextQuote);
      return nextQuote;
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return null;
      }
      setQuote(null);
      setQuoteError(
        error instanceof Error ? error.message : "Failed to fetch quote.",
      );
      return null;
    } finally {
      if (requestId === requestIdRef.current) {
        setQuoting(false);
      }
    }
  }, [
    account,
    fromTokenAddress,
    inputsValid,
    parsedAmount,
    selectedChainId,
    toTokenAddress,
  ]);

  useEffect(() => {
    if (!inputsValid) {
      requestIdRef.current += 1;
      setQuote(null);
      setQuoteError(null);
      setQuoting(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void refreshQuote();
    }, QUOTE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [
    inputsValid,
    refreshQuote,
    account,
    selectedChainId,
    fromTokenAddress,
    toTokenAddress,
    parsedAmount,
  ]);

  const clearQuote = useCallback(() => {
    requestIdRef.current += 1;
    setQuote(null);
    setQuoteError(null);
    setQuoting(false);
  }, []);

  return {
    quote,
    quoting,
    quoteError,
    refreshQuote,
    clearQuote,
    inputsValid,
  };
}
