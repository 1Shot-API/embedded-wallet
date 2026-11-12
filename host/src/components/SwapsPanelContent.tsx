import type { EIP1193Provider } from "@1shotapi/ows-provider";
import { EVMChainId } from "@1shotapi/ows-types";
import { useEffect, useMemo, useState } from "react";
import { formatUnits, parseUnits } from "viem";

import {
  defaultFromToken,
  defaultToToken,
  findSwapChain,
  findSwapToken,
  getChainLogo,
  getSwapTokensForChain,
  resolveSwapChainId,
  swapChainLabel,
  tokenDisplayLogo,
  walletMatchesSelectedSwapChain,
} from "@/constants/swapTokens";
import { useDebouncedLifiQuote } from "@/hooks/useDebouncedLifiQuote";
import { executeLifiSwap } from "@/lib/executeLifiSwap";

import { ExchangeCard } from "./swaps/ExchangeCard";
import {
  SwapAmountField,
  SwapReceivePreview,
} from "./swaps/SwapAmountField";
import { SwapNetworkPrompt } from "./swaps/SwapNetworkPrompt";
import { SwapSettingsPopover } from "./swaps/SwapSettingsPopover";
import {
  SwapErrorBanner,
  SwapSuccessBanner,
} from "./swaps/SwapSuccessBanner";
import { TokenPicker } from "./swaps/TokenPicker";

function networkLabel(hexChainId: string): string {
  return swapChainLabel(hexChainId) ?? "your current network";
}

function explorerLabelForChain(chainLabel: string | undefined): string {
  if (chainLabel === "Base") {
    return "BaseScan";
  }
  if (chainLabel === "Ethereum") {
    return "Etherscan";
  }
  return "block explorer";
}

function formatTokenAmount(amount: string, decimals: number): string {
  return formatUnits(BigInt(amount), decimals);
}

export function SwapsPanelContent({
  ready,
  account,
  chainId,
  getEthereumProvider,
}: {
  ready: boolean;
  account: string | null;
  chainId: string;
  getEthereumProvider: () => EIP1193Provider | null;
}) {
  const [selectedChainId, setSelectedChainId] = useState(() =>
    resolveSwapChainId(chainId),
  );
  const [fromTokenAddress, setFromTokenAddress] = useState<string>("");
  const [toTokenAddress, setToTokenAddress] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [swapping, setSwapping] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [completedSwap, setCompletedSwap] = useState<{
    swapHash: string;
    explorerUrl: string | null;
  } | null>(null);
  const [switchingNetwork, setSwitchingNetwork] = useState(false);
  const [networkSwitchError, setNetworkSwitchError] = useState<string | null>(
    null,
  );

  const needsNetworkSwitch =
    Boolean(account) &&
    !walletMatchesSelectedSwapChain(chainId, selectedChainId);
  const targetChainMeta = findSwapChain(selectedChainId);

  const chainTokens = useMemo(
    () => getSwapTokensForChain(selectedChainId),
    [selectedChainId],
  );
  const chainLogo = getChainLogo(selectedChainId);
  const chainMeta = findSwapChain(selectedChainId);

  const fromToken = findSwapToken(selectedChainId, fromTokenAddress);
  const toToken = findSwapToken(selectedChainId, toTokenAddress);

  useEffect(() => {
    setSelectedChainId(resolveSwapChainId(chainId));
    setNetworkSwitchError(null);
  }, [chainId]);

  useEffect(() => {
    if (!needsNetworkSwitch) {
      setNetworkSwitchError(null);
    }
  }, [needsNetworkSwitch]);

  useEffect(() => {
    const from = defaultFromToken(selectedChainId);
    const to = defaultToToken(selectedChainId);
    setFromTokenAddress(from?.address ?? "");
    setToTokenAddress(to?.address ?? "");
    setSwapError(null);
    setCompletedSwap(null);
  }, [selectedChainId]);

  const parsedAmount = useMemo(() => {
    if (!fromToken || amount.trim() === "") {
      return null;
    }
    try {
      const value = parseUnits(amount.trim(), fromToken.decimals);
      return value > 0n ? value : null;
    } catch {
      return null;
    }
  }, [amount, fromToken]);

  const amountError =
    amount.trim() !== "" && parsedAmount === null
      ? "Enter a valid amount."
      : null;

  const { quote, quoting, quoteError, refreshQuote, clearQuote, inputsValid } =
    useDebouncedLifiQuote({
      account,
      selectedChainId,
      fromTokenAddress,
      toTokenAddress,
      parsedAmount,
      enabled: ready && Boolean(account) && !needsNetworkSwitch,
    });

  const receiveAmount =
    quote != null
      ? formatTokenAmount(
          quote.estimate.toAmount,
          quote.action.toToken.decimals,
        )
      : null;
  const minReceiveAmount =
    quote != null
      ? formatTokenAmount(
          quote.estimate.toAmountMin,
          quote.action.toToken.decimals,
        )
      : null;

  const fromDisplayLogo = tokenDisplayLogo(
    fromToken,
    quote?.action.fromToken.logoURI,
  );
  const toDisplayLogo = tokenDisplayLogo(toToken, quote?.action.toToken.logoURI);

  const clearSwapFeedback = () => {
    setSwapError(null);
    setCompletedSwap(null);
  };

  const switchWalletToSelectedChain = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      return;
    }

    setSwitchingNetwork(true);
    setNetworkSwitchError(null);

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: EVMChainId(selectedChainId as `0x${string}`) }],
      });
    } catch (error) {
      setNetworkSwitchError(
        error instanceof Error
          ? error.message
          : "Failed to switch wallet network.",
      );
    } finally {
      setSwitchingNetwork(false);
    }
  };

  const handleChainChange = (nextChainId: string) => {
    setSelectedChainId(nextChainId);
    clearQuote();
    clearSwapFeedback();
    setNetworkSwitchError(null);

    const provider = getEthereumProvider();
    if (!provider) {
      return;
    }

    void (async () => {
      setSwitchingNetwork(true);
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: EVMChainId(nextChainId as `0x${string}`) }],
        });
      } catch (error) {
        setNetworkSwitchError(
          error instanceof Error
            ? error.message
            : "Failed to switch wallet network.",
        );
      } finally {
        setSwitchingNetwork(false);
      }
    })();
  };

  const handleFromTokenChange = (address: string) => {
    setFromTokenAddress(address);
    clearQuote();
    clearSwapFeedback();
  };

  const handleToTokenChange = (address: string) => {
    setToTokenAddress(address);
    clearQuote();
    clearSwapFeedback();
  };

  const handleAmountChange = (value: string) => {
    setAmount(value);
    clearQuote();
    clearSwapFeedback();
  };

  const handleNewSwap = () => {
    clearSwapFeedback();
    clearQuote();
    setAmount("");
  };

  const handleExchange = () => {
    const provider = getEthereumProvider();
    if (!provider || !account) {
      return;
    }

    if (needsNetworkSwitch) {
      setSwapError("Switch your wallet to the swap network before exchanging.");
      return;
    }

    setSwapping(true);
    clearSwapFeedback();

    void (async () => {
      try {
        const activeQuote = quote ?? (await refreshQuote());
        if (!activeQuote) {
          throw new Error("No quote available. Check amount and tokens.");
        }

        const result = await executeLifiSwap({
          provider,
          account,
          quote: activeQuote,
        });

        const explorerBase = chainMeta?.blockExplorerUrl;
        setCompletedSwap({
          swapHash: result.swapHash,
          explorerUrl:
            explorerBase != null
              ? `${explorerBase}/tx/${result.swapHash}`
              : null,
        });
      } catch (error) {
        setSwapError(
          error instanceof Error ? error.message : "Swap failed.",
        );
      } finally {
        setSwapping(false);
      }
    })();
  };

  const exchangeDisabled =
    needsNetworkSwitch ||
    !inputsValid ||
    quoting ||
    swapping ||
    quote == null ||
    completedSwap != null;

  const swapFormDisabled = needsNetworkSwitch || switchingNetwork || swapping;

  if (!ready) {
    return (
      <p className="text-muted-foreground text-sm">Connecting to wallet…</p>
    );
  }

  if (!account) {
    return (
      <p className="text-muted-foreground text-sm">
        Connect your wallet above to swap tokens.
      </p>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 [overflow-anchor:none]">
      {needsNetworkSwitch && targetChainMeta ? (
        <SwapNetworkPrompt
          currentNetworkLabel={networkLabel(chainId)}
          targetNetworkLabel={targetChainMeta.label}
          switching={switchingNetwork}
          error={networkSwitchError}
          onSwitch={() => {
            void switchWalletToSelectedChain();
          }}
        />
      ) : null}

      <ExchangeCard
        headerActions={
          <SwapSettingsPopover
            selectedChainId={selectedChainId}
            disabled={swapFormDisabled}
            onChainChange={handleChainChange}
          />
        }
      >
        <div
          className={
            needsNetworkSwitch ? "pointer-events-none opacity-50" : undefined
          }
          aria-hidden={needsNetworkSwitch}
        >
        <div className="flex items-stretch gap-1">
          <TokenPicker
            label="From"
            token={
              fromToken
                ? { ...fromToken, logoURI: fromDisplayLogo ?? fromToken.logoURI }
                : undefined
            }
            tokens={chainTokens}
            chainLogo={chainLogo}
            disabled={swapFormDisabled}
            onSelect={handleFromTokenChange}
          />
          <TokenPicker
            label="To"
            token={
              toToken
                ? { ...toToken, logoURI: toDisplayLogo ?? toToken.logoURI }
                : undefined
            }
            tokens={chainTokens}
            chainLogo={chainLogo}
            disabled={swapFormDisabled}
            onSelect={handleToTokenChange}
          />
        </div>

        <SwapAmountField
          token={
            fromToken
              ? { ...fromToken, logoURI: fromDisplayLogo ?? fromToken.logoURI }
              : undefined
          }
          amount={amount}
          amountError={amountError}
          disabled={swapFormDisabled}
          onAmountChange={handleAmountChange}
        />

        <SwapReceivePreview
          quoting={quoting && completedSwap == null && !needsNetworkSwitch}
          quoteError={completedSwap == null && !needsNetworkSwitch ? quoteError : null}
          receiveAmount={receiveAmount}
          receiveSymbol={quote?.action.toToken.symbol ?? toToken?.symbol ?? null}
          minReceiveAmount={minReceiveAmount}
          routeTool={quote?.tool}
        />
        </div>

        {completedSwap ? (
          <SwapSuccessBanner
            swapHash={completedSwap.swapHash}
            explorerUrl={completedSwap.explorerUrl}
            explorerLabel={explorerLabelForChain(chainMeta?.label)}
            onDismiss={handleNewSwap}
          />
        ) : null}

        {swapError ? <SwapErrorBanner message={swapError} /> : null}

        {!completedSwap ? (
          <button
            type="button"
            disabled={exchangeDisabled}
            onClick={handleExchange}
            className="h-12 w-full rounded-xl bg-[#2563eb] text-base font-semibold text-white transition-colors hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {swapping ? "Exchanging…" : quoting ? "Fetching quote…" : "Exchange"}
          </button>
        ) : null}
      </ExchangeCard>

      <p className="max-w-[420px] text-center text-xs leading-relaxed text-neutral-500">
        Same-chain swaps on the mainnets listed in the network settings.
        Routes depend on LI.FI network support. Transactions are signed and
        sent through the 1Shot wallet with gas abstraction.
      </p>
    </div>
  );
}
