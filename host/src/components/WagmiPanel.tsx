import { oneShotWallet } from "@1shotapi/wagmi-connector";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { parseEther } from "viem";
import {
  createConfig,
  http,
  useCallsStatus,
  useChainId,
  useChains,
  useConnect,
  useConnection,
  useConnectors,
  useDisconnect,
  useSendCalls,
  useSendTransaction,
  useSignMessage,
  useSignTypedData,
  useSwitchChain,
  WagmiProvider,
} from "wagmi";
import { base, baseSepolia, mainnet, zora } from "wagmi/chains";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Module scope so the connector's Branding iframe survives tab switches.
 * Zora is deliberately unsupported by the wallet to show the
 * unsupported-chain `SwitchChainError`.
 */
const wagmiConfig = createConfig({
  chains: [base, baseSepolia, mainnet, zora],
  connectors: [oneShotWallet({ walletUrl: __WALLET_IFRAME_URL__ })],
  multiInjectedProviderDiscovery: false,
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
    [mainnet.id]: http(),
    [zora.id]: http(),
  },
});

const queryClient = new QueryClient();

export default function WagmiPanel() {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-6 pb-8">
          <WagmiPlayground />
        </div>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

function WagmiPlayground() {
  const connection = useConnection();
  const chainId = useChainId();
  const chains = useChains();
  const oneShot = useConnectors().find((c) => c.id === "oneShotWallet");

  const connect = useConnect();
  const disconnect = useDisconnect();
  const switchChain = useSwitchChain();
  const signMessage = useSignMessage();
  const signTypedData = useSignTypedData();
  const sendTransaction = useSendTransaction();
  const sendCalls = useSendCalls();
  const callsStatus = useCallsStatus({
    id: sendCalls.data?.id ?? "",
    query: { enabled: Boolean(sendCalls.data?.id) },
  });

  const address = connection.address;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>wagmi connector</CardTitle>
          <CardDescription>
            No hand-written <code>OWSProxy</code> here — wagmi drives the
            Branding Layer through <code>oneShotWallet()</code> from{" "}
            <code>@1shotapi/wagmi-connector</code>, pointed at{" "}
            <code>{__WALLET_IFRAME_URL__}</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm">
            Status: <strong>{connection.status}</strong>
          </p>
          <p className="font-mono text-sm break-all">
            {address ?? "—"} · {chains.find((c) => c.id === chainId)?.name} (
            {chainId})
          </p>
          <div className="flex flex-wrap gap-2">
            {connection.isConnected ? (
              <Button type="button" onClick={() => disconnect.mutate()}>
                Disconnect
              </Button>
            ) : (
              <Button
                type="button"
                disabled={!oneShot || connect.isPending}
                onClick={() =>
                  oneShot && connect.mutate({ connector: oneShot })
                }
              >
                {connect.isPending ? "Connecting…" : "Connect 1Shot Wallet"}
              </Button>
            )}
          </div>
          <ErrorLine error={connect.error ?? disconnect.error} />
        </CardContent>
      </Card>

      {connection.isConnected && address ? (
        <>
          <Section title="Switch chain">
            <div className="flex flex-wrap gap-2">
              {chains.map((chain) => (
                <Button
                  key={chain.id}
                  type="button"
                  variant="outline"
                  disabled={chain.id === chainId || switchChain.isPending}
                  onClick={() => switchChain.mutate({ chainId: chain.id })}
                >
                  {chain.name}
                </Button>
              ))}
            </div>
            <ErrorLine error={switchChain.error} />
          </Section>

          <Section title="Sign">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  signMessage.mutate({ message: "Hello from wagmi + 1Shot" })
                }
              >
                personal_sign
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  signTypedData.mutate({
                    domain: {
                      name: "1Shot wagmi host",
                      version: "1",
                      chainId,
                    },
                    types: {
                      Mail: [
                        { name: "to", type: "address" },
                        { name: "contents", type: "string" },
                      ],
                    },
                    primaryType: "Mail",
                    message: { to: address, contents: "Hello, typed data" },
                  })
                }
              >
                eth_signTypedData_v4
              </Button>
            </div>
            <Result value={signMessage.data} error={signMessage.error} />
            <Result value={signTypedData.data} error={signTypedData.error} />
          </Section>

          <Section title="Send">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  sendTransaction.mutate({ to: address, value: parseEther("0") })
                }
              >
                Send 0 ETH to self
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  sendCalls.mutate({
                    calls: [
                      { to: address, value: 0n },
                      { to: address, value: 0n },
                    ],
                  })
                }
              >
                wallet_sendCalls ×2
              </Button>
            </div>
            <Result value={sendTransaction.data} error={sendTransaction.error} />
            <Result value={sendCalls.data?.id} error={sendCalls.error} />
            {callsStatus.data ? (
              <p className="text-sm">Calls status: {callsStatus.data.status}</p>
            ) : null}
          </Section>
        </>
      ) : null}
    </>
  );
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{props.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">{props.children}</CardContent>
    </Card>
  );
}

function Result(props: { value: string | undefined; error: Error | null }) {
  return (
    <>
      {props.value ? (
        <pre className="bg-muted overflow-auto rounded-md p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {props.value}
        </pre>
      ) : null}
      <ErrorLine error={props.error} />
    </>
  );
}

function ErrorLine(props: { error: Error | null }) {
  if (!props.error) return null;
  return (
    <p role="alert" className="text-destructive text-sm">
      {props.error.name}: {props.error.message.split("\n")[0]}
    </p>
  );
}
