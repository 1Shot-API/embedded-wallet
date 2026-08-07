import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { OWSProxy } from "@1shotapi/ows-provider";
import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  type EVMTransactionHash,
  type IExecutionPermissionResponse,
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
import {
  buildSiwePersonalMessage,
  buildSiweTypedData,
  DEFAULT_TYPED_DATA_JSON,
  parseTypedDataJson,
  randomSiweNonce,
  type SignMode,
} from "../constants/signDemo";
import {
  DEMO_EXECUTION_DELEGATEE,
  FOCUS_USDC_ARC,
  FOCUS_USDT_BASE,
  HOST_CHAINS,
  hostChainMeta,
  type UsdcMode,
} from "../components/hostChains";

const USDC_DECIMALS = 6;

/** One USDC in atoms (6 decimals), as hex for EIP-7715 periodAmount. */
const ONE_USDC_ATOMS_HEX = HexString(`0x${(1_000_000).toString(16)}`);

type SessionGrant = {
  id: string;
  response: IExecutionPermissionResponse;
};

function truncateHex(value: string, head = 10, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

function grantSummary(response: IExecutionPermissionResponse): string {
  const permissionType = response.permission.type;
  const chain = String(response.chainId);
  const to = truncateHex(String(response.to));
  return `${permissionType} · ${chain} · to ${to}`;
}

function normalizeChainIdHex(value: string): EVMChainId {
  return EVMChainId(`0x${BigInt(value).toString(16)}`);
}

async function resolveAccount(
  proxy: OWSProxy,
): Promise<EVMAccountAddress> {
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
}

function buildSiweParams(
  account: EVMAccountAddress,
  chainIdHex: string,
): {
  domain: string;
  address: string;
  uri: string;
  chainId: number;
  nonce: string;
} {
  return {
    domain: window.location.host,
    address: String(account),
    uri: window.location.origin,
    chainId: Number(BigInt(chainIdHex)),
    nonce: randomSiweNonce(),
  };
}

export interface IUseHostTestActionsParams {
  proxyRef: RefObject<OWSProxy | null>;
  lastStyleRef: RefObject<Record<string, unknown> | null>;
}

export function useHostTestActions({
  proxyRef,
  lastStyleRef,
}: IUseHostTestActionsParams) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<string>(HOST_CHAINS[0].value);
  const [message, setMessage] = useState("Hello from 1Shot Wallet");
  const [signMode, setSignMode] = useState<SignMode>("message");
  const [typedDataJson, setTypedDataJson] = useState(DEFAULT_TYPED_DATA_JSON);
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
  const [sessionGrants, setSessionGrants] = useState<SessionGrant[]>([]);
  const [delegationsOutput, setDelegationsOutput] = useState<string | null>(
    null,
  );
  const grantSeqRef = useRef(0);

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

  useEffect(() => {
    if (!ready) return;
    const proxy = proxyRef.current;
    if (!proxy) return;

    const onChainChanged = (next: unknown) => {
      try {
        setChainId(String(normalizeChainIdHex(String(next))));
      } catch (error) {
        console.error("[oneshot-wallet-host] chainChanged failed", error);
      }
    };
    const onAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts)) return;
      const first = accounts[0];
      setAccount(first == null ? null : String(first));
    };

    proxy.ethereum.on("chainChanged", onChainChanged);
    proxy.ethereum.on("accountsChanged", onAccountsChanged);
    return () => {
      proxy.ethereum.removeListener("chainChanged", onChainChanged);
      proxy.ethereum.removeListener("accountsChanged", onAccountsChanged);
    };
  }, [ready, proxyRef]);

  const resolveAndStoreAccount = useCallback(
    async (proxy: OWSProxy): Promise<EVMAccountAddress> => {
      const next = await resolveAccount(proxy);
      setAccount(String(next));
      return next;
    },
    [],
  );

  const handleConnect = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Requesting accounts…");
    void (async () => {
      try {
        const accounts = await proxy.ethereum.request({
          method: "eth_requestAccounts",
        });
        const next = accounts[0];
        if (!next) {
          throw new Error("No account returned from wallet");
        }
        setAccount(String(next));
        reportStatus(`Connected as ${next}`);
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "Connect failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
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

    if (signMode === "message") {
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
          const account = await resolveAndStoreAccount(proxy);
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
      return;
    }

    let typedData: Record<string, unknown>;
    try {
      typedData = parseTypedDataJson(typedDataJson);
    } catch (error) {
      reportStatus(
        error instanceof Error ? error.message : "Invalid typed data JSON.",
        true,
      );
      return;
    }

    setBusy(true);
    setSignature(null);
    reportStatus("Requesting accounts…");

    void (async () => {
      try {
        const account = await resolveAndStoreAccount(proxy);
        reportStatus("Approve the passkey prompt to sign…");
        const nextSignature = await proxy.ethereum.request({
          method: "eth_signTypedData_v4",
          params: [account, typedData],
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

  const handleLoadSiwe = () => {
    const address =
      account ?? "0x0000000000000000000000000000000000000001";
    const params = buildSiweParams(
      EVMAccountAddress(address as `0x${string}`),
      chainId,
    );
    if (signMode === "message") {
      setMessage(buildSiwePersonalMessage(params));
      reportStatus("Loaded SIWE personal_sign message — click Sign to approve.");
      return;
    }
    setTypedDataJson(JSON.stringify(buildSiweTypedData(params), null, 2));
    reportStatus("Loaded SIWE typed data — click Sign to approve.");
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
        const account = await resolveAndStoreAccount(proxy);
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
        const account = await resolveAndStoreAccount(proxy);
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

  const handleFocusUsdcArc = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Focusing wallet on Arc USDC…");
    void (async () => {
      try {
        await proxy.rpc("focusWallet", {
          chainId: FOCUS_USDC_ARC.chainId,
          assetAddress: FOCUS_USDC_ARC.assetAddress,
        });
        setChainId(FOCUS_USDC_ARC.chainId);
        proxy.showWallet();
        setWalletVisible(true);
        reportStatus("Wallet focused on USDC (Arc Testnet).");
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "focusWallet failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleFocusUsdtBase = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Focusing wallet on Base USDT…");
    void (async () => {
      try {
        await proxy.rpc("focusWallet", {
          chainId: FOCUS_USDT_BASE.chainId,
          assetAddress: FOCUS_USDT_BASE.assetAddress,
        });
        setChainId(FOCUS_USDT_BASE.chainId);
        proxy.showWallet();
        setWalletVisible(true);
        reportStatus("Wallet focused on Tether (Base).");
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "focusWallet failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleUnfocusWallet = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Restoring general wallet mode…");
    void (async () => {
      try {
        await proxy.rpc("unfocusWallet");
        reportStatus("Wallet restored to general mode.");
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "unfocusWallet failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleAddUsdcArc = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Requesting add Arc USDC…");
    void (async () => {
      try {
        await proxy.rpc("addAsset", {
          chainId: FOCUS_USDC_ARC.chainId,
          assetAddress: FOCUS_USDC_ARC.assetAddress,
        });
        proxy.showWallet();
        setWalletVisible(true);
        reportStatus("Arc USDC added to tracked assets.");
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "addAsset failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleAddUsdtBase = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Requesting add Base USDT…");
    void (async () => {
      try {
        await proxy.rpc("addAsset", {
          chainId: FOCUS_USDT_BASE.chainId,
          assetAddress: FOCUS_USDT_BASE.assetAddress,
        });
        proxy.showWallet();
        setWalletVisible(true);
        reportStatus("Base USDT added to tracked assets.");
      } catch (error) {
        reportStatus(
          error instanceof Error ? error.message : "addAsset failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleRequestDelegation = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    setDelegationsOutput(null);
    reportStatus("Requesting EIP-7715 execution permission…");
    void (async () => {
      try {
        proxy.showWallet();
        setWalletVisible(true);
        const account = await resolveAndStoreAccount(proxy);
        const activeChain = await refreshChainFromWallet(proxy);
        const meta = hostChainMeta(String(activeChain));
        if (!meta) {
          throw new Error(
            `No USDC fixture for chain ${activeChain}. Switch to a listed chain.`,
          );
        }
        const responses = await proxy.ethereum.request({
          method: "wallet_requestExecutionPermissions",
          params: [
            {
              chainId: activeChain,
              from: account,
              to: EVMAccountAddress(DEMO_EXECUTION_DELEGATEE),
              permission: {
                type: "erc20-token-periodic",
                isAdjustmentAllowed: true,
                data: {
                  tokenAddress: meta.usdc,
                  periodAmount: ONE_USDC_ATOMS_HEX,
                  periodDuration: 86_400,
                },
              },
            },
          ],
        });
        const next: SessionGrant[] = responses.map((response) => {
          grantSeqRef.current += 1;
          return {
            id: `grant-${grantSeqRef.current}`,
            response,
          };
        });
        setSessionGrants((prev) => [...next, ...prev]);
        reportStatus(
          next.length === 1
            ? "Permission granted (kept in memory)."
            : `${next.length} permissions granted (kept in memory).`,
        );
      } catch (error) {
        reportStatus(
          error instanceof Error
            ? error.message
            : "requestExecutionPermissions failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleCancelDelegation = (id: string) => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    const grant = sessionGrants.find((g) => g.id === id);
    if (!grant) {
      reportStatus("Grant not found in session memory.", true);
      return;
    }
    setBusy(true);
    setDelegationsOutput(null);
    reportStatus("Canceling EIP-7715 permission…");
    void (async () => {
      try {
        proxy.showWallet();
        setWalletVisible(true);
        await proxy.ethereum.request({
          method: "wallet_revokeExecutionPermission",
          params: [{ permissionContext: grant.response.context }],
        });
        setSessionGrants((prev) => prev.filter((g) => g.id !== id));
        reportStatus("Permission canceled on-chain and removed from memory.");
      } catch (error) {
        reportStatus(
          error instanceof Error
            ? error.message
            : "revokeExecutionPermission failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleGetSupportedPermissions = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Fetching supported execution permissions…");
    void (async () => {
      try {
        const result = await proxy.ethereum.request({
          method: "wallet_getSupportedExecutionPermissions",
        });
        setDelegationsOutput(JSON.stringify(result, null, 2));
        reportStatus("Supported permissions loaded.");
      } catch (error) {
        reportStatus(
          error instanceof Error
            ? error.message
            : "getSupportedExecutionPermissions failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const handleGetGrantedPermissions = () => {
    const proxy = proxyRef.current;
    if (!proxy) return;
    setBusy(true);
    reportStatus("Fetching granted execution permissions…");
    void (async () => {
      try {
        const result = await proxy.ethereum.request({
          method: "wallet_getGrantedExecutionPermissions",
        });
        setDelegationsOutput(JSON.stringify(result, null, 2));
        reportStatus(
          Array.isArray(result)
            ? `${result.length} granted permission(s) from vault.`
            : "Granted permissions loaded.",
        );
      } catch (error) {
        reportStatus(
          error instanceof Error
            ? error.message
            : "getGrantedExecutionPermissions failed",
          true,
        );
      } finally {
        setBusy(false);
      }
    })();
  };

  const walletActionProps = {
    ready,
    busy,
    account,
    chainId,
    message,
    signMode,
    typedDataJson,
    usdcMode,
    usdcDestination,
    usdcAmount,
    status,
    statusIsError,
    signature,
    usdcOutput,
    txHash,
    txExplorerUrl,
    onConnect: handleConnect,
    onChainChange: handleChainChange,
    onRefreshChain: handleRefreshChain,
    onMessageChange: setMessage,
    onSignModeChange: setSignMode,
    onTypedDataJsonChange: setTypedDataJson,
    onUsdcModeChange: handleUsdcModeChange,
    onUsdcDestinationChange: setUsdcDestination,
    onUsdcAmountChange: setUsdcAmount,
    onSign: handleSign,
    onLoadSiwe: handleLoadSiwe,
    walletVisible,
    onToggleWallet: handleToggleWallet,
    onUsdcAction: handleUsdcAction,
    onFocusUsdcArc: handleFocusUsdcArc,
    onFocusUsdtBase: handleFocusUsdtBase,
    onUnfocusWallet: handleUnfocusWallet,
    onAddUsdcArc: handleAddUsdcArc,
    onAddUsdtBase: handleAddUsdtBase,
    sessionGrants: sessionGrants.map((g) => ({
      id: g.id,
      summary: grantSummary(g.response),
      json: JSON.stringify(g.response, null, 2),
    })),
    delegationsOutput,
    onRequestDelegation: handleRequestDelegation,
    onCancelDelegation: handleCancelDelegation,
    onGetSupportedPermissions: handleGetSupportedPermissions,
    onGetGrantedPermissions: handleGetGrantedPermissions,
  };

  return {
    ready,
    setReady,
    setWalletVisible,
    reportStatus,
    refreshChainFromWallet,
    walletActionProps,
    handleApplyStyle,
  };
}
