import { useCallback, useEffect, useRef, useState } from "react";
import {
  EWalletPresentationMode,
  OWSProxy,
} from "@1shotapi/ows-provider";
import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  type EVMTransactionHash,
} from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  encodeFunctionData,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import { AppHeader } from "./components/AppHeader";
import { AppSidebar, type HostMode } from "./components/AppSidebar";
import { DesignPanel } from "./components/DesignPanel";
import { TestPanel } from "./components/TestPanel";
import {
  HOST_CHAINS,
  hostChainMeta,
  type UsdcMode,
} from "./components/WalletActions";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";

const USDC_DECIMALS = 6;

function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

/** MetaMask-like branding panel size (also default in ows-provider). */
const WALLET_SIZE_X = 360;
const WALLET_SIZE_Y = 600;

export function App() {
  const flyoutContainerRef = useRef<HTMLDivElement | null>(null);
  const proxyRef = useRef<OWSProxy | null>(null);
  /** Last setStyle payload from Design mode — re-applied after Test recreate. */
  const lastStyleRef = useRef<Record<string, unknown> | null>(null);
  const [previewMount, setPreviewMount] = useState<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<HostMode>("test");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chainId, setChainId] = useState<string>(HOST_CHAINS[0].value);
  const [message, setMessage] = useState("Hello from 1Shot Wallet");
  const [usdcMode, setUsdcMode] = useState<UsdcMode>("balance");
  const [usdcDestination, setUsdcDestination] = useState("");
  const [usdcAmount, setUsdcAmount] = useState("");
  const [status, setStatus] = useState("Connecting to wallet…");
  const [statusIsError, setStatusIsError] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [usdcOutput, setUsdcOutput] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txExplorerUrl, setTxExplorerUrl] = useState<string | null>(null);
  const [walletVisible, setWalletVisible] = useState(false);

  const reportStatus = useCallback((next: string, isError = false) => {
    setStatus(next);
    setStatusIsError(isError);
  }, []);

  const clearUsdcOutputs = useCallback(() => {
    setUsdcOutput(null);
    setTxHash(null);
    setTxExplorerUrl(null);
  }, []);

  const refreshChainFromWallet = useCallback(
    async (proxy: OWSProxy): Promise<EVMChainId> => {
      const next = normalizeChainIdHex(
        await proxy.ethereum.request({ method: "eth_chainId" }),
      );
      setChainId(String(next));
      return next;
    },
    [],
  );

  // Presentation is create-time only. Switching Test ↔ Design destroys and
  // recreates the proxy against the right container (reparenting breaks Postmate).
  useEffect(() => {
    if (mode === "design" && !previewMount) {
      return;
    }

    const container =
      mode === "design" ? previewMount : flyoutContainerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    setReady(false);
    setWalletVisible(false);
    reportStatus("Connecting to wallet…");

    console.info(
      "[oneshot-wallet-host] creating Branding Layer proxy",
      mode,
      __WALLET_IFRAME_URL__,
    );

    void (async () => {
      proxyRef.current?.destroy();
      proxyRef.current = null;
      container.replaceChildren();

      try {
        const proxy = await OWSProxy.create(container, __WALLET_IFRAME_URL__, {
          walletSizeX: WALLET_SIZE_X,
          walletSizeY: WALLET_SIZE_Y,
          presentationMode:
            mode === "design"
              ? EWalletPresentationMode.Inline
              : EWalletPresentationMode.Flyout,
        });
        if (cancelled) {
          proxy.destroy();
          return;
        }
        proxyRef.current = proxy;

        if (lastStyleRef.current) {
          await proxy.rpc("setStyle", lastStyleRef.current);
        }

        if (cancelled) {
          proxy.destroy();
          proxyRef.current = null;
          return;
        }

        setReady(true);
        try {
          const connectedChain = await refreshChainFromWallet(proxy);
          reportStatus(
            mode === "design"
              ? `Design preview connected on ${connectedChain}. Apply setStyle to refresh.`
              : `Wallet connected on ${connectedChain}. Enter a message and click Sign.`,
          );
        } catch (error) {
          reportStatus(
            error instanceof Error ? error.message : "Failed to read chain id",
            true,
          );
        }
      } catch (error) {
        if (cancelled) return;
        console.error("[oneshot-wallet-host] failed to start", error);
        reportStatus(
          error instanceof Error
            ? error.message
            : "Failed to connect to wallet",
          true,
        );
      }
    })();

    return () => {
      cancelled = true;
      proxyRef.current?.destroy();
      proxyRef.current = null;
    };
  }, [mode, previewMount, refreshChainFromWallet, reportStatus]);

  // Keep the Show/Hide label in sync when the wallet closes itself (× / menu).
  useEffect(() => {
    if (mode !== "test") {
      return;
    }
    const container = flyoutContainerRef.current;
    if (!container) {
      return;
    }

    const syncVisibility = () => {
      const width = container.offsetWidth;
      const height = container.offsetHeight;
      // Full flyout ≈ wallet size; hidden is 0×0; RPC passthrough is 1×1.
      setWalletVisible(width > 32 && height > 32);
    };

    syncVisibility();
    const observer = new ResizeObserver(syncVisibility);
    observer.observe(container);
    return () => observer.disconnect();
  }, [mode, ready]);

  const resolveAccount = async (
    proxy: OWSProxy,
  ): Promise<EVMAccountAddress> => {
    let accounts = await proxy.ethereum.request({ method: "eth_accounts" });
    if (accounts.length === 0) {
      accounts = await proxy.ethereum.request({
        method: "eth_requestAccounts",
      });
    }
    const account = accounts[0];
    if (!account) {
      throw new Error("No account returned from wallet");
    }
    return account;
  };

  const handleChainChange = (next: string) => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const selected = EVMChainId(next as `0x${string}`);
    setBusy(true);
    clearUsdcOutputs();
    void (async () => {
      try {
        await proxy.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: selected }],
        });
        setChainId(String(selected));
        reportStatus(`Switched to ${selected}`);
      } catch (error) {
        await refreshChainFromWallet(proxy).catch(() => undefined);
        reportStatus(
          error instanceof Error ? error.message : "Chain switch failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleRefreshChain = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    void (async () => {
      try {
        const next = await refreshChainFromWallet(proxy);
        reportStatus(`Chain synced: ${next}`);
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "Failed to refresh chain",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleUsdcModeChange = (next: UsdcMode) => {
    setUsdcMode(next);
    clearUsdcOutputs();
  };

  const handleSign = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const trimmed = message.trim();
    if (!trimmed) {
      reportStatus("Enter a message to sign.", true);
      return;
    }

    setBusy(true);
    setSignature(null);
    reportStatus("Requesting accounts…");

    void (async () => {
      try {
        const account = await resolveAccount(proxy);
        reportStatus("Approve the passkey prompt to sign…");
        const nextSignature = await proxy.ethereum.request({
          method: "personal_sign",
          params: [trimmed, account],
        });
        setSignature(nextSignature);
        reportStatus(`Signed as ${account}`);
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "Signing failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleCheckUsdcBalance = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const meta = hostChainMeta(chainId);
    if (!meta) {
      reportStatus("USDC is not configured for this chain.", true);
      clearUsdcOutputs();
      return;
    }

    setBusy(true);
    clearUsdcOutputs();
    reportStatus("Reading USDC balance…");

    void (async () => {
      try {
        const token = getAddress(meta.usdc) as Address;
        const account = await resolveAccount(proxy);
        const owner = getAddress(account) as Address;
        const client = createPublicClient({
          transport: custom(proxy.ethereum),
        });

        const [name, symbol, balance, decimals] = await Promise.all([
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "name",
          }),
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "symbol",
          }),
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [owner],
          }),
          client.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "decimals",
          }),
        ]);

        setUsdcOutput(
          [
            `Contract: ${token}`,
            `Account:  ${owner}`,
            `Name:     ${name}`,
            `Symbol:   ${symbol}`,
            `Balance:  ${formatUnits(balance, decimals)} ${symbol}`,
            `Raw:      ${balance.toString()}`,
          ].join("\n"),
        );
        reportStatus(
          `Balance for ${symbol}: ${formatUnits(balance, decimals)}`,
        );
      } catch (error) {
        reportStatus(
          error instanceof Error
            ? error.message
            : "Failed to read USDC balance",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleSendUsdc = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const meta = hostChainMeta(chainId);
    if (!meta) {
      reportStatus("USDC is not configured for this chain.", true);
      clearUsdcOutputs();
      return;
    }

    const destinationRaw = usdcDestination.trim();
    if (!isAddress(destinationRaw)) {
      reportStatus("Enter a valid destination address.", true);
      clearUsdcOutputs();
      return;
    }

    let amount: bigint;
    try {
      amount = parseUnits(usdcAmount.trim(), USDC_DECIMALS);
    } catch {
      reportStatus("Enter a valid USDC amount.", true);
      clearUsdcOutputs();
      return;
    }
    if (amount <= 0n) {
      reportStatus("Amount must be greater than zero.", true);
      clearUsdcOutputs();
      return;
    }

    setBusy(true);
    clearUsdcOutputs();
    reportStatus("Preparing USDC transfer…");

    void (async () => {
      try {
        const account = await resolveAccount(proxy);
        const to = getAddress(destinationRaw) as Address;
        const data = encodeFunctionData({
          abi: erc20Abi,
          functionName: "transfer",
          args: [to, amount],
        }) as Hex;
        const activeChainId = EVMChainId(chainId as `0x${string}`);

        reportStatus("Approve the transaction in the wallet…");
        const hash = (await proxy.ethereum.request({
          method: "eth_sendTransaction",
          params: [
            {
              from: account,
              to: EVMAccountAddress(meta.usdc as `0x${string}`),
              data: HexString(data),
              value: HexString("0x0"),
              chainId: activeChainId,
            },
          ],
        })) as EVMTransactionHash;

        setUsdcOutput(`Transaction hash:\n${hash}`);
        setTxHash(hash);
        setTxExplorerUrl(`${meta.blockExplorerUrl}/tx/${hash}`);
        reportStatus(`USDC sent. Hash ${hash}`);
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "Failed to send USDC",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleUsdcAction = () => {
    if (usdcMode === "send") {
      handleSendUsdc();
    } else {
      handleCheckUsdcBalance();
    }
  };

  const handleToggleWallet = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;

    if (walletVisible) {
      proxy.hideWallet();
      setWalletVisible(false);
      reportStatus("Wallet panel hidden.");
      return;
    }

    proxy.showWallet();
    setWalletVisible(true);
    reportStatus("Wallet panel shown. Use Hide Wallet or the wallet menu to close.");
  };

  const handleApplyStyle = async (options: Record<string, unknown>) => {
    lastStyleRef.current = options;
    const proxy = proxyRef.current;
    if (!proxy) {
      throw new Error("Wallet not connected");
    }
    await proxy.rpc("setStyle", options);
  };

  const walletActionProps = {
    ready,
    busy,
    chainId,
    message,
    usdcMode,
    usdcDestination,
    usdcAmount,
    status,
    statusIsError,
    signature,
    usdcOutput,
    txHash,
    txExplorerUrl,
    onChainChange: handleChainChange,
    onRefreshChain: handleRefreshChain,
    onMessageChange: setMessage,
    onUsdcModeChange: handleUsdcModeChange,
    onUsdcDestinationChange: setUsdcDestination,
    onUsdcAmountChange: setUsdcAmount,
    onSign: handleSign,
    walletVisible,
    onToggleWallet: handleToggleWallet,
    onUsdcAction: handleUsdcAction,
  };

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <AppSidebar mode={mode} onModeChange={setMode} />
        <SidebarInset className="bg-muted min-h-svh">
          <AppHeader />
          {mode === "test" ? (
            <TestPanel {...walletActionProps} />
          ) : (
            <DesignPanel
              ready={ready}
              onApplyStyle={handleApplyStyle}
              previewMountRef={setPreviewMount}
            />
          )}
        </SidebarInset>
        {/* Flyout create() target — never reparented; Test mode only. */}
        <div ref={flyoutContainerRef} aria-hidden="true" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
