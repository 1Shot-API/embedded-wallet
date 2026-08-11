import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown }) => Promise<unknown>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (
    event: string,
    listener: (...args: unknown[]) => void,
  ) => void;
  is1Shot?: boolean;
  isMetaMask?: boolean;
};

type Eip6963ProviderDetail = {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthereumProvider;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider & { providers?: EthereumProvider[] };
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function InjectedPanel() {
  const [providers, setProviders] = useState<Eip6963ProviderDetail[]>([]);
  const [selectedRdns, setSelectedRdns] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);
  const [chainId, setChainId] = useState<string | null>(null);
  const [status, setStatus] = useState(
    "Waiting for EIP-6963 announce / window.ethereum…",
  );
  const [log, setLog] = useState<string[]>([]);

  const appendLog = (line: string) => {
    setLog((prev) => [line, ...prev].slice(0, 40));
  };

  useEffect(() => {
    const seen = new Map<string, Eip6963ProviderDetail>();

    const onAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<Eip6963ProviderDetail>).detail;
      if (!detail?.info?.rdns || !detail.provider) return;
      seen.set(detail.info.rdns, detail);
      const next = [...seen.values()];
      setProviders(next);
      setSelectedRdns(
        (current) =>
          current ??
          next.find((p) => p.info.rdns === "com.1shotapi.wallet")?.info.rdns ??
          next[0]?.info.rdns ??
          null,
      );
      setStatus(
        `EIP-6963: ${next.map((p) => p.info.name).join(", ") || "(none)"}`,
      );
    };

    window.addEventListener(
      "eip6963:announceProvider",
      onAnnounce as EventListener,
    );
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    if (window.ethereum) {
      appendLog(
        `window.ethereum present (is1Shot=${String(window.ethereum.is1Shot)}, isMetaMask=${String(window.ethereum.isMetaMask)})`,
      );
    } else {
      appendLog(
        "window.ethereum absent — inject the 1Shot extension on this tab",
      );
    }

    return () => {
      window.removeEventListener(
        "eip6963:announceProvider",
        onAnnounce as EventListener,
      );
    };
  }, []);

  const activeProvider = (): EthereumProvider | undefined => {
    const from6963 = providers.find((p) => p.info.rdns === selectedRdns);
    if (from6963) return from6963.provider;
    return window.ethereum;
  };

  const connect = async () => {
    const eth = activeProvider();
    if (!eth) {
      setStatus("No provider — use the extension Inject button on this tab first");
      return;
    }
    try {
      setStatus("eth_requestAccounts…");
      const result = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];
      setAccounts(result);
      const chain = (await eth.request({ method: "eth_chainId" })) as string;
      setChainId(chain);
      setStatus(`Connected ${result[0] ?? "(no account)"} on ${chain}`);
      appendLog(`accounts: ${JSON.stringify(result)}`);
    } catch (error) {
      setStatus(formatError(error));
      appendLog(`error: ${formatError(error)}`);
    }
  };

  const personalSign = async () => {
    const eth = activeProvider();
    const account = accounts[0];
    if (!eth || !account) {
      setStatus("Connect an account first");
      return;
    }
    try {
      const message = `1Shot inject test ${new Date().toISOString()}`;
      setStatus("personal_sign…");
      const sig = await eth.request({
        method: "personal_sign",
        params: [message, account],
      });
      appendLog(`personal_sign → ${String(sig).slice(0, 42)}…`);
      setStatus("Signed");
    } catch (error) {
      setStatus(formatError(error));
      appendLog(`error: ${formatError(error)}`);
    }
  };

  const refreshProviders = () => {
    setProviders([]);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    setStatus("Re-requested EIP-6963 announce");
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle>Injected provider playground</CardTitle>
          <CardDescription>
            No <code>OWSProxy</code> on this page — only{" "}
            <code>window.ethereum</code> / EIP-6963 from the browser extension.
            Open this host tab, use the extension <strong>Inject</strong> control,
            then Connect here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">{status}</p>
          {chainId ? (
            <p className="font-mono text-sm">
              chainId={chainId}
              {accounts[0] ? ` · ${accounts[0]}` : null}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void connect()}>
              Connect
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void personalSign()}
              disabled={!accounts[0]}
            >
              personal_sign
            </Button>
            <Button type="button" variant="outline" onClick={refreshProviders}>
              Refresh EIP-6963
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Detected providers</p>
            {providers.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                None yet. Inject 1Shot on this tab, then click Refresh EIP-6963.
                With MetaMask installed, enable Prefer 1Shot in extension
                Settings if you need <code>window.ethereum</code> to be 1Shot.
              </p>
            ) : (
              <ul className="flex flex-col gap-1">
                {providers.map((p) => (
                  <li key={p.info.uuid}>
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="provider"
                        checked={selectedRdns === p.info.rdns}
                        onChange={() => setSelectedRdns(p.info.rdns)}
                      />
                      <span>
                        {p.info.name}{" "}
                        <span className="text-muted-foreground">
                          ({p.info.rdns})
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <pre className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs">
            {log.join("\n") || "(log empty)"}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
