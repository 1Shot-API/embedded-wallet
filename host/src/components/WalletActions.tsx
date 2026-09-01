import { RefreshCwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { SignMode } from "@/constants/signDemo";
import {
  BRIDGE_SESSION_SOURCE,
  BRIDGE_SOURCE_CHAINS,
  BRIDGE_SPEED_UNSET,
  BRIDGE_USER_PICKS_DEST,
  bridgeDestinationsForSource,
  isBridgeAmountValid,
  type BridgeSpeedOption,
} from "@/constants/bridgeDemo";
import { EnableArcMainnet } from "@/features";
import { ChainSelector, type IChainSelectorOption } from "./ChainSelector";
import {
  DEMO_ADD_ASSET_ICON_URL,
  FOCUS_USDT_BASE,
  hostChainMeta,
  type UsdcMode,
} from "./hostChains";

export type { UsdcMode } from "./hostChains";
export type { SignMode } from "@/constants/signDemo";

export interface IWalletActionsProps {
  ready: boolean;
  busy: boolean;
  account: string | null;
  chainId: string;
  message: string;
  signMode: SignMode;
  typedDataJson: string;
  usdcMode: UsdcMode;
  usdcDestination: string;
  usdcAmount: string;
  status: string;
  statusIsError: boolean;
  signature: string | null;
  usdcOutput: string | null;
  txHash: string | null;
  txExplorerUrl: string | null;
  onConnect: () => void;
  onChainChange: (chainId: string) => void;
  onRefreshChain: () => void;
  onMessageChange: (message: string) => void;
  onSignModeChange: (mode: SignMode) => void;
  onTypedDataJsonChange: (json: string) => void;
  onUsdcModeChange: (mode: UsdcMode) => void;
  onUsdcDestinationChange: (address: string) => void;
  onUsdcAmountChange: (amount: string) => void;
  onSign: () => void;
  onLoadSiwe: () => void;
  walletVisible: boolean;
  onToggleWallet: () => void;
  onUsdcAction: () => void;
  onFocusUsdcArc: () => void;
  onFocusUsdtBase: () => void;
  onUnfocusWallet: () => void;
  onAddAsset: (params: {
    chainId: string;
    assetAddress: string;
    iconUrl?: string;
  }) => void;
  onOnramp: () => void;
  onBridge: () => void;
  bridgeSourceChainId: string;
  bridgeDestinationChainId: string;
  bridgeAmount: string;
  bridgeSpeed: BridgeSpeedOption | "";
  onBridgeSourceChange: (value: string) => void;
  onBridgeDestinationChange: (value: string) => void;
  onBridgeAmountChange: (value: string) => void;
  onBridgeSpeedChange: (value: BridgeSpeedOption | "") => void;
  /** In-memory grants from this session (`wallet_requestExecutionPermissions`). */
  sessionGrants: ReadonlyArray<{
    id: string;
    summary: string;
    json: string;
  }>;
  delegationsOutput: string | null;
  onRequestDelegation: () => void;
  onCancelDelegation: (id: string) => void;
  onGetSupportedPermissions: () => void;
  onGetGrantedPermissions: () => void;
}

export function WalletActions({
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
  onConnect,
  onChainChange,
  onRefreshChain,
  onMessageChange,
  onSignModeChange,
  onTypedDataJsonChange,
  onUsdcModeChange,
  onUsdcDestinationChange,
  onUsdcAmountChange,
  onSign,
  onLoadSiwe,
  walletVisible,
  onToggleWallet,
  onUsdcAction,
  onFocusUsdcArc,
  onFocusUsdtBase,
  onUnfocusWallet,
  onAddAsset,
  onOnramp,
  onBridge,
  bridgeSourceChainId,
  bridgeDestinationChainId,
  bridgeAmount,
  bridgeSpeed,
  onBridgeSourceChange,
  onBridgeDestinationChange,
  onBridgeAmountChange,
  onBridgeSpeedChange,
  sessionGrants,
  delegationsOutput,
  onRequestDelegation,
  onCancelDelegation,
  onGetSupportedPermissions,
  onGetGrantedPermissions,
}: IWalletActionsProps) {
  const meta = hostChainMeta(chainId);
  const [addAssetChainId, setAddAssetChainId] = useState<string>(
    FOCUS_USDT_BASE.chainId,
  );
  const [addAssetAddress, setAddAssetAddress] = useState<string>(
    FOCUS_USDT_BASE.assetAddress,
  );
  const [addAssetIconUrl, setAddAssetIconUrl] = useState(DEMO_ADD_ASSET_ICON_URL);
  const addAssetAddressValid = /^0x[0-9a-fA-F]{40}$/.test(addAssetAddress.trim());
  const addAssetIconTrimmed = addAssetIconUrl.trim();
  const addAssetIconValid =
    addAssetIconTrimmed.length === 0 ||
    /^https:\/\/.+/i.test(addAssetIconTrimmed);

  const bridgeDestinations = useMemo(
    () => bridgeDestinationsForSource(bridgeSourceChainId, chainId),
    [bridgeSourceChainId, chainId],
  );

  const bridgeSourceOptions = useMemo((): readonly IChainSelectorOption[] => {
    return BRIDGE_SOURCE_CHAINS.map((chain) => ({
      value: chain.value,
      label: chain.label,
      isTestnet: chain.networkType === "testnet",
      weight: chain.weight,
      badge:
        chain.value.toLowerCase() === chainId.toLowerCase()
          ? "Session"
          : undefined,
    }));
  }, [chainId]);

  const bridgeDestinationOptions = useMemo((): readonly IChainSelectorOption[] => {
    return bridgeDestinations.map((chain) => ({
      value: chain.value,
      label: chain.label,
      isTestnet: chain.networkType === "testnet",
      weight: chain.weight,
    }));
  }, [bridgeDestinations]);

  const bridgeAmountValid = isBridgeAmountValid(bridgeAmount);
  const bridgeDisabled = !ready || busy || !bridgeAmountValid;

  function handleBridgeSourceChange(value: string): void {
    onBridgeSourceChange(value);
    const nextDestinations = bridgeDestinationsForSource(value, chainId);
    if (
      bridgeDestinationChainId &&
      !nextDestinations.some(
        (chain) => chain.value === bridgeDestinationChainId,
      )
    ) {
      onBridgeDestinationChange("");
    }
  }
  const tokenSymbol = meta?.tokenSymbol ?? "USDC";
  const accountLabel = account
    ? `${account.slice(0, 6)}…${account.slice(-4)}`
    : ready
      ? "Not connected"
      : "Connecting…";

  return (
    <section className="flex flex-col gap-3" aria-label="Wallet actions">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium">Account</p>
          <p className="text-foreground font-mono text-sm">{accountLabel}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!ready || busy} onClick={onConnect}>
            Connect
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready}
            onClick={onToggleWallet}
          >
            {walletVisible ? "Hide Wallet" : "Show Wallet"}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="chain-select" className="shrink-0">
          Chain
        </Label>
        <ChainSelector
          id="chain-select"
          ariaLabel="Chain"
          value={chainId}
          disabled={!ready || busy}
          triggerClassName="min-w-40 flex-1"
          onValueChange={onChainChange}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Refresh chain from wallet"
          title="Refresh chain from wallet"
          disabled={!ready || busy}
          onClick={onRefreshChain}
        >
          <RefreshCwIcon />
        </Button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Tabs
          value={signMode}
          onValueChange={(value) => {
            if (value === "message" || value === "typedData") {
              onSignModeChange(value);
            }
          }}
        >
          <TabsList className="w-full">
            <TabsTrigger value="message" className="flex-1">
              Message
            </TabsTrigger>
            <TabsTrigger value="typedData" className="flex-1">
              Typed Data (EIP-712)
            </TabsTrigger>
          </TabsList>
        </Tabs>
        {signMode === "message" ? (
          <>
            <Label htmlFor="message-input">Message to sign</Label>
            <Textarea
              id="message-input"
              rows={3}
              value={message}
              disabled={!ready}
              onChange={(event) => onMessageChange(event.target.value)}
            />
          </>
        ) : (
          <>
            <Label htmlFor="typed-data-input">Typed Data JSON</Label>
            <Textarea
              id="typed-data-input"
              rows={3}
              className="field-sizing-fixed resize-y overflow-auto font-mono text-xs"
              spellCheck={false}
              value={typedDataJson}
              disabled={!ready}
              onChange={(event) => onTypedDataJsonChange(event.target.value)}
            />
          </>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={!ready || busy} onClick={onSign}>
          Sign
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={onLoadSiwe}
        >
          SIWE
        </Button>
      </div>

      <p
        className={`min-h-5 text-sm ${statusIsError ? "text-destructive" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {status}
      </p>

      {signature ? (
        <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {signature}
        </pre>
      ) : null}

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="usdc-mode-select">USDC</Label>
        <Select
          value={usdcMode}
          disabled={!ready || busy}
          onValueChange={(value) => {
            if (value === "balance" || value === "send") {
              onUsdcModeChange(value);
            }
          }}
        >
          <SelectTrigger id="usdc-mode-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="balance">Check Balance</SelectItem>
            <SelectItem value="send">Send {tokenSymbol}</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-muted-foreground font-mono text-xs break-all">
          {meta ? `${tokenSymbol}: ${meta.usdc}` : "Token: unsupported chain"}
        </p>
      </div>

      {usdcMode === "send" ? (
        <>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdc-destination-input">Destination</Label>
            <Input
              id="usdc-destination-input"
              className="font-mono text-[0.85rem]"
              spellCheck={false}
              autoComplete="off"
              placeholder="0x…"
              value={usdcDestination}
              disabled={!ready}
              onChange={(event) =>
                onUsdcDestinationChange(event.target.value)
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="usdc-amount-input">Amount (USDC)</Label>
            <Input
              id="usdc-amount-input"
              spellCheck={false}
              autoComplete="off"
              inputMode="decimal"
              placeholder="1.0"
              value={usdcAmount}
              disabled={!ready}
              onChange={(event) => onUsdcAmountChange(event.target.value)}
            />
          </div>
        </>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={onUsdcAction}
        >
          {usdcMode === "send" ? `Send ${tokenSymbol}` : "Check Balance"}
        </Button>
      </div>

      {usdcOutput ? (
        <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
          {usdcOutput}
        </pre>
      ) : null}

      {txHash && txExplorerUrl ? (
        <p className="text-muted-foreground text-sm">
          <a
            href={txExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View on explorer
          </a>
        </p>
      ) : null}

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label>Focus mode</Label>
        <p className="text-muted-foreground text-xs">
          Host-controlled shell: lock the wallet to one chain + asset, or restore
          general mode.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onFocusUsdcArc}
          >
            Focus USDC (Arc)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onFocusUsdtBase}
          >
            Focus Tether (Base)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onUnfocusWallet}
          >
            Unfocus
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Add asset</Label>
        <p className="text-muted-foreground text-xs">
          Propose a tracked asset via <code>addAsset</code> (user must confirm
          in the wallet). Optional HTTPS <code>iconUrl</code> is shown after
          approval.
        </p>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-asset-chain" className="text-xs font-normal">
              Chain
            </Label>
            <ChainSelector
              id="add-asset-chain"
              ariaLabel="Add asset chain"
              value={addAssetChainId}
              disabled={!ready || busy}
              onValueChange={setAddAssetChainId}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-asset-address" className="text-xs font-normal">
              Token address
            </Label>
            <Input
              id="add-asset-address"
              value={addAssetAddress}
              onChange={(event) => setAddAssetAddress(event.target.value)}
              placeholder="0x…"
              className="font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="add-asset-icon" className="text-xs font-normal">
              Icon URL (optional, https)
            </Label>
            <Input
              id="add-asset-icon"
              value={addAssetIconUrl}
              onChange={(event) => setAddAssetIconUrl(event.target.value)}
              placeholder="https://…"
              className="font-mono text-xs"
              spellCheck={false}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={
              !ready || busy || !addAssetAddressValid || !addAssetIconValid
            }
            onClick={() =>
              onAddAsset({
                chainId: addAssetChainId,
                assetAddress: addAssetAddress.trim(),
                ...(addAssetIconTrimmed
                  ? { iconUrl: addAssetIconTrimmed }
                  : {}),
              })
            }
          >
            Add asset
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>{EnableArcMainnet ? "Onramp / Bridge" : "Bridge"}</Label>
        <p className="text-muted-foreground text-xs">
          {EnableArcMainnet ? (
            <>
              Open Circle fiat onramp via <code>onramp</code>, or gasless CCTP
              USDC bridge via <code>bridge</code>. Pre-fill source, destination,
              amount, and speed — when amount, destination, and speed are all
              set, the wallet skips setup and shows the confirmation quote.
            </>
          ) : (
            <>
              Open gasless CCTP USDC bridge via <code>bridge</code>. Pre-fill
              source, destination, amount, and speed — when amount, destination,
              and speed are all set, the wallet skips setup and shows the
              confirmation quote.
            </>
          )}
        </p>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="bridge-source-select">Source chain</Label>
              <ChainSelector
                id="bridge-source-select"
                ariaLabel="Bridge source chain"
                value={bridgeSourceChainId}
                disabled={!ready || busy}
                options={bridgeSourceOptions}
                leadingOptions={[
                  {
                    value: BRIDGE_SESSION_SOURCE,
                    label: "Session chain",
                    icon: "wallet",
                  },
                ]}
                onValueChange={handleBridgeSourceChange}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <Label htmlFor="bridge-destination-select">Destination</Label>
              <ChainSelector
                id="bridge-destination-select"
                ariaLabel="Bridge destination chain"
                value={bridgeDestinationChainId || BRIDGE_USER_PICKS_DEST}
                disabled={!ready || busy}
                options={bridgeDestinationOptions}
                leadingOptions={[
                  {
                    value: BRIDGE_USER_PICKS_DEST,
                    label: "User picks in wallet",
                    icon: "wallet",
                  },
                ]}
                onValueChange={(value) => {
                  onBridgeDestinationChange(
                    value === BRIDGE_USER_PICKS_DEST ? "" : value,
                  );
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bridge-amount-input">Amount (USDC)</Label>
              <Input
                id="bridge-amount-input"
                spellCheck={false}
                autoComplete="off"
                inputMode="decimal"
                placeholder="1.0"
                value={bridgeAmount}
                disabled={!ready || busy}
                onChange={(event) => onBridgeAmountChange(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bridge-speed-select">Speed</Label>
              <Select
                value={bridgeSpeed || BRIDGE_SPEED_UNSET}
                disabled={!ready || busy}
                onValueChange={(value) => {
                  onBridgeSpeedChange(
                    value === BRIDGE_SPEED_UNSET
                      ? ""
                      : (value as BridgeSpeedOption),
                  );
                }}
              >
                <SelectTrigger id="bridge-speed-select" className="w-full">
                  <SelectValue placeholder="User picks in wallet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={BRIDGE_SPEED_UNSET}>
                    User picks in wallet
                  </SelectItem>
                  <SelectItem value="fast">Fast</SelectItem>
                  <SelectItem value="slow">Standard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {EnableArcMainnet ? (
            <Button
              type="button"
              variant="outline"
              disabled={!ready || busy}
              onClick={onOnramp}
            >
              Onramp
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            disabled={bridgeDisabled}
            onClick={onBridge}
          >
            Bridge
          </Button>
        </div>
      </div>

      <hr className="border-border my-1" />

      <div className="flex flex-col gap-1.5">
        <Label>Delegations (EIP-7715)</Label>
        <p className="text-muted-foreground text-xs">
          Request a periodic USDC spending permission for the current chain
          (session key held in memory only). Relayer-enabled chains only.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onRequestDelegation}
          >
            Request permission
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onGetSupportedPermissions}
          >
            Get supported
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={onGetGrantedPermissions}
          >
            Get granted
          </Button>
        </div>

        {sessionGrants.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {sessionGrants.map((grant) => (
              <li
                key={grant.id}
                className="border-border flex flex-col gap-2 rounded-md border p-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-foreground m-0 text-xs font-medium">
                    {grant.summary}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={!ready || busy}
                    onClick={() => onCancelDelegation(grant.id)}
                  >
                    Cancel
                  </Button>
                </div>
                <pre className="border-border bg-muted/40 m-0 max-h-40 overflow-auto rounded-md border p-2 font-mono text-[0.65rem] break-all whitespace-pre-wrap">
                  {grant.json}
                </pre>
              </li>
            ))}
          </ul>
        ) : null}

        {delegationsOutput ? (
          <pre className="border-border bg-muted/40 overflow-x-auto rounded-md border p-3 font-mono text-xs break-all whitespace-pre-wrap">
            {delegationsOutput}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
