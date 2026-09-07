import { useEffect, useMemo, useState } from "react";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type IExecutionPermission,
} from "@1shotapi/ows-types";
import { formatUnits, getAddress, hexToBigInt, isHex, parseUnits } from "viem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIFI_SWAP_PERIODIC } from "../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import { useStyle } from "../../style/StyleProvider";
import type {
  IGrantExecutionPermissionRequest,
  IGrantExecutionPermissionResult,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { TokenAmountInput } from "../TokenAmountInput";
import { CopyableText } from "../CopyableText";

function readString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "string" && raw.trim() !== "") return raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return "";
}

function readAmountAtoms(data: Record<string, unknown>): bigint | null {
  const raw = data.periodAmount ?? data.amount;
  if (raw === undefined || raw === null) return null;
  try {
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(raw);
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) {
        return hexToBigInt(trimmed as `0x${string}`);
      }
      return BigInt(trimmed);
    }
  } catch {
    return null;
  }
  return null;
}

function truncateMiddle(value: string, head = 10, tail = 8): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

/**
 * Host EIP-7715 LiFi swap grant consent — periodic input budget + pinned route.
 */
export function GrantLiFiSwapPermissionModal({
  request,
  onResolve,
  onReject,
}: {
  request: IGrantExecutionPermissionRequest;
  onResolve: (result: IGrantExecutionPermissionResult) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.grantLiFiSwapPermission;
  const { account } = style.copy;
  const { listTrackedAssets, resolveChain, liFiUtils, getKnownAsset } =
    useWallet();
  const permission = request.request.permission;
  const adjustable = permission.isAdjustmentAllowed !== false;
  const data = permission.data;

  const initialToken = readString(data, "tokenAddress", "inputToken");
  const [tokenOptions, setTokenOptions] = useState<
    Array<{ address: string; symbol: string; decimals: number; label: string }>
  >([]);
  const [tokenAddress, setTokenAddress] = useState(initialToken);
  const [amountText, setAmountText] = useState("");
  const [durationText, setDurationText] = useState(
    readString(data, "periodDuration", "period", "duration") || "86400",
  );
  const [startText, setStartText] = useState(
    readString(data, "startDate", "start"),
  );
  const [slippageText, setSlippageText] = useState(
    readString(data, "slippageBps") || String(liFiUtils.defaultSlippageBps),
  );
  const [memo, setMemo] = useState("");
  const [initializedAmount, setInitializedAmount] = useState(false);

  const lifiDiamond = readString(data, "lifiDiamond");
  const quoteSigner = readString(data, "quoteSigner");
  const outputAssetId = readString(data, "outputAssetId");
  const outputRecipient = readString(data, "outputRecipient");
  const destinationChainId = readString(data, "destinationChainId");

  useEffect(() => {
    let cancelled = false;
    void listTrackedAssets().then(async (assets) => {
      if (cancelled) return;
      const onChain = assets.filter(
        (a) =>
          a.type === EAssetType.Erc20 &&
          String(a.chainId).toLowerCase() ===
            String(request.request.chainId).toLowerCase(),
      );
      const options = onChain.map((a) => ({
        address: getAddress(String(a.address)),
        symbol: a.symbol,
        decimals: a.decimals ?? 6,
        label: `${a.symbol} (${a.name})`,
      }));
      if (
        initialToken &&
        !options.some(
          (o) => o.address.toLowerCase() === initialToken.toLowerCase(),
        )
      ) {
        try {
          const known = await getKnownAsset(
            request.request.chainId,
            EVMAccountAddress(getAddress(initialToken as `0x${string}`)),
          );
          options.unshift({
            address: getAddress(initialToken as `0x${string}`),
            symbol: known?.symbol ?? "TOKEN",
            decimals: known?.decimals ?? 6,
            label: known ? `${known.symbol} (${known.name})` : initialToken,
          });
        } catch {
          /* leave options as-is */
        }
      }
      if (cancelled) return;
      setTokenOptions(options);
      if (!tokenAddress && options[0]) {
        setTokenAddress(options[0].address);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    getKnownAsset,
    initialToken,
    listTrackedAssets,
    request.request.chainId,
    tokenAddress,
  ]);

  const selected = useMemo(() => {
    const match = tokenOptions.find(
      (o) => o.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    return (
      match ?? {
        address: tokenAddress,
        symbol: "TOKEN",
        decimals: 6,
        label: tokenAddress,
      }
    );
  }, [tokenAddress, tokenOptions]);

  useEffect(() => {
    if (initializedAmount || !tokenAddress) return;
    const atoms = readAmountAtoms(data);
    if (atoms !== null) {
      try {
        setAmountText(formatUnits(atoms, selected.decimals));
      } catch {
        setAmountText("");
      }
    }
    setInitializedAmount(true);
  }, [data, initializedAmount, selected.decimals, tokenAddress]);

  const amountError = useMemo(() => {
    const trimmed = amountText.trim();
    if (!trimmed) return null;
    try {
      const parsed = parseUnits(trimmed, selected.decimals);
      if (parsed <= 0n) return copy.invalidAmountError;
      return null;
    } catch {
      return copy.invalidAmountError;
    }
  }, [amountText, copy.invalidAmountError, selected.decimals]);

  const durationError = useMemo(() => {
    const trimmed = durationText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
      return copy.invalidDurationError;
    }
    return null;
  }, [copy.invalidDurationError, durationText]);

  const slippageError = useMemo(() => {
    const trimmed = slippageText.trim();
    if (!trimmed) return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n >= 10_000) {
      return copy.invalidSlippageError;
    }
    return null;
  }, [copy.invalidSlippageError, slippageText]);

  const pinsValid =
    Boolean(lifiDiamond) &&
    Boolean(quoteSigner) &&
    isHex(outputAssetId) &&
    (outputAssetId.length - 2) / 2 === 32 &&
    isHex(outputRecipient) &&
    (outputRecipient.length - 2) / 2 === 32 &&
    Boolean(destinationChainId);

  const formReady =
    Boolean(tokenAddress) &&
    amountText.trim() !== "" &&
    amountError === null &&
    durationText.trim() !== "" &&
    durationError === null &&
    slippageText.trim() !== "" &&
    slippageError === null &&
    pinsValid;

  const chainLabel =
    resolveChain(request.request.chainId)?.label ?? request.chainName;

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{to}", request.request.to)
    .replace("{chainName}", chainLabel)
    .replace("{permissionType}", permission.type);

  const reject = () => {
    onReject(new OwsUserRejectedError("User rejected the permission request"));
  };

  const grant = () => {
    if (!formReady) return;
    const periodAmount = parseUnits(amountText.trim(), selected.decimals);
    const periodDuration = Number(durationText.trim());
    const slippageBps = Number(slippageText.trim());
    const startTrimmed = startText.trim();
    const nextData: Record<string, unknown> = {
      lifiDiamond: EVMAccountAddress(
        getAddress(lifiDiamond as `0x${string}`),
      ),
      tokenAddress: EVMAccountAddress(
        getAddress(tokenAddress as `0x${string}`),
      ),
      outputAssetId,
      outputRecipient,
      destinationChainId,
      quoteSigner: EVMAccountAddress(
        getAddress(quoteSigner as `0x${string}`),
      ),
      periodAmount: `0x${periodAmount.toString(16)}`,
      periodDuration,
      slippageBps,
    };
    if (startTrimmed) {
      nextData.startDate = Number(startTrimmed);
    }
    const nextPermission: IExecutionPermission = {
      type: LIFI_SWAP_PERIODIC,
      isAdjustmentAllowed: permission.isAdjustmentAllowed,
      data: nextData,
    };
    onResolve({ permission: nextPermission, memo: memo.trim() });
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={reject}
      actions={[
        {
          label: copy.rejectLabel,
          variant: "secondary",
          onClick: reject,
        },
        {
          label:
            request.batchIndex < request.batchCount - 1
              ? copy.nextLabel
              : copy.grantLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !formReady,
          onClick: grant,
        },
      ]}
    >
      <p className="text-muted-foreground m-0 text-sm">{body}</p>
      <p className="text-muted-foreground m-0 mt-2 text-xs">{copy.quoteNote}</p>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.hostLabel}
          </dt>
          <dd className="text-foreground m-0">{request.domain}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.toLabel}
          </dt>
          <dd className="m-0 min-w-0">
            <CopyableText
              text={request.request.to}
              truncate
              copyLabel={account.copyAddressLabel}
              copiedLabel={account.addressCopiedLabel}
              copyFailedLabel={account.addressCopyFailedLabel}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.chainLabel}
          </dt>
          <dd className="text-foreground m-0">{chainLabel}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.permissionTypeLabel}
          </dt>
          <dd className="text-foreground m-0 font-mono text-xs">
            {permission.type}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.lifiDiamondLabel}
          </dt>
          <dd className="m-0 min-w-0 font-mono text-xs break-all">
            {lifiDiamond || "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.quoteSignerLabel}
          </dt>
          <dd className="m-0 min-w-0 font-mono text-xs break-all">
            {quoteSigner || "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.outputAssetLabel}
          </dt>
          <dd className="text-foreground m-0 font-mono text-xs">
            {outputAssetId ? truncateMiddle(outputAssetId) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.outputRecipientLabel}
          </dt>
          <dd className="text-foreground m-0 font-mono text-xs">
            {outputRecipient ? truncateMiddle(outputRecipient) : "—"}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.destinationChainLabel}
          </dt>
          <dd className="text-foreground m-0">{destinationChainId || "—"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-swap-token">{copy.tokenLabel}</Label>
          {adjustable && tokenOptions.length > 0 ? (
            <select
              id="lifi-swap-token"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={tokenAddress}
              onChange={(event) => setTokenAddress(event.target.value)}
            >
              {tokenOptions.map((option) => (
                <option key={option.address} value={option.address}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="m-0 break-all font-mono text-xs">
              {tokenAddress || "—"}
            </p>
          )}
        </div>

        <TokenAmountInput
          label={copy.periodAmountLabel}
          placeholder={copy.periodAmountPlaceholder}
          symbol={selected.symbol}
          value={amountText}
          onChange={setAmountText}
          disabled={!adjustable}
          error={amountError}
        />

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-swap-duration">{copy.periodDurationLabel}</Label>
          <Input
            id="lifi-swap-duration"
            inputMode="numeric"
            disabled={!adjustable}
            placeholder={copy.periodDurationPlaceholder}
            value={durationText}
            onChange={(event) => setDurationText(event.target.value)}
            aria-invalid={Boolean(durationError)}
          />
          <p className="text-muted-foreground m-0 text-xs">
            {copy.periodDurationHint}
          </p>
          {durationError ? (
            <p className="text-destructive m-0 text-xs" role="alert">
              {durationError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-swap-slippage">{copy.slippageLabel}</Label>
          <Input
            id="lifi-swap-slippage"
            inputMode="numeric"
            disabled={!adjustable}
            value={slippageText}
            onChange={(event) => setSlippageText(event.target.value)}
            aria-invalid={Boolean(slippageError)}
          />
          <p className="text-muted-foreground m-0 text-xs">{copy.slippageHint}</p>
          {slippageError ? (
            <p className="text-destructive m-0 text-xs" role="alert">
              {slippageError}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-swap-start">{copy.startLabel}</Label>
          <Input
            id="lifi-swap-start"
            inputMode="numeric"
            disabled={!adjustable}
            value={startText}
            onChange={(event) => setStartText(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-swap-memo">{copy.memoLabel}</Label>
          <Textarea
            id="lifi-swap-memo"
            placeholder={copy.memoPlaceholder}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
