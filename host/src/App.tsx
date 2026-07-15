import { useCallback, useEffect, useRef, useState } from "react";
import { OWSProxy } from "@1shotapi/ows-provider";
import { EVMAccountAddress, EVMChainId } from "@1shotapi/ows-types";
import {
  createPublicClient,
  custom,
  erc20Abi,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
} from "viem";
import { AppHeader } from "./components/AppHeader";
import { AppSidebar, type HostMode } from "./components/AppSidebar";
import { DesignPanel } from "./components/DesignPanel";
import { TestPanel } from "./components/TestPanel";
import { HOST_CHAINS } from "./components/WalletActions";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { TooltipProvider } from "./components/ui/tooltip";

function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

export function App() {
  const walletContainerRef = useRef<HTMLDivElement | null>(null);
  const proxyRef = useRef<OWSProxy | null>(null);

  const [mode, setMode] = useState<HostMode>("test");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [chainId, setChainId] = useState<string>(HOST_CHAINS[0].value);
  const [message, setMessage] = useState("Hello from 1Shot Wallet");
  const [tokenAddress, setTokenAddress] = useState("");
  const [status, setStatus] = useState("Connecting to wallet…");
  const [statusIsError, setStatusIsError] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);

  const reportStatus = useCallback((next: string, isError = false) => {
    setStatus(next);
    setStatusIsError(isError);
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

  useEffect(() => {
    let cancelled = false;
    const container = walletContainerRef.current;
    if (!container) return;

    console.info(
      "[oneshot-wallet-host] embedding Branding Layer",
      __WALLET_IFRAME_URL__,
    );

    void (async () => {
      try {
        const proxy = await OWSProxy.create(container, __WALLET_IFRAME_URL__, {
          // Slightly taller flyout for design-mode preview.
          walletSizeX: 360,
          walletSizeY: 520,
        });
        if (cancelled) return;
        proxyRef.current = proxy;
        setReady(true);
        try {
          const connectedChain = await refreshChainFromWallet(proxy);
          reportStatus(
            `Wallet connected on ${connectedChain}. Enter a message and click Sign.`,
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
    };
  }, [refreshChainFromWallet, reportStatus]);

  // Design mode keeps the branding flyout visible; Test keeps it hidden.
  useEffect(() => {
    const proxy = proxyRef.current;
    if (!proxy || !ready) return;
    if (mode === "design") {
      proxy.showWallet();
    } else {
      proxy.hideWallet();
    }
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

  const handleCheckBalance = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const rawAddress = tokenAddress.trim();
    if (!isAddress(rawAddress)) {
      reportStatus("Enter a valid ERC-20 contract address.", true);
      setTokenBalance(null);
      return;
    }

    setBusy(true);
    setTokenBalance(null);
    reportStatus("Reading token balance…");

    void (async () => {
      try {
        const token = getAddress(rawAddress) as Address;
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

        setTokenBalance(
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
            : "Failed to read token balance",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleShowWallet = () => {
    proxyRef.current?.showWallet();
    reportStatus("Wallet panel shown. Use × in the wallet to hide.");
  };

  const handleApplyStyle = async (options: Record<string, unknown>) => {
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
    tokenAddress,
    status,
    statusIsError,
    signature,
    tokenBalance,
    onChainChange: handleChainChange,
    onRefreshChain: handleRefreshChain,
    onMessageChange: setMessage,
    onTokenAddressChange: setTokenAddress,
    onSign: handleSign,
    onShowWallet: handleShowWallet,
    onCheckBalance: handleCheckBalance,
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
            <DesignPanel ready={ready} onApplyStyle={handleApplyStyle} />
          )}
        </SidebarInset>
        <div ref={walletContainerRef} aria-hidden="true" />
      </SidebarProvider>
    </TooltipProvider>
  );
}
