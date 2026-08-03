import { useEffect, useMemo, useState } from "react";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type IExecutionPermission,
} from "@1shotapi/ows-types";
import { formatUnits, getAddress, parseUnits } from "viem";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ERC20_TOKEN_PERIODIC } from "../../lib/interfaces/business/IDelegationService";
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

function readTokenAddress(data: Record<string, unknown>): string | null {
  const raw = data.tokenAddress ?? data.token;
  return typeof raw === "string" ? raw : null;
}

function readAmountAtoms(data: Record<string, unknown>): bigint | null {
  const raw = data.periodAmount ?? data.amount;
  if (raw === undefined || raw === null) return null;
  try {
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number") return BigInt(raw);
    if (typeof raw === "string") return BigInt(raw);
  } catch {
    return null;
  }
  return null;
}

function readDuration(data: Record<string, unknown>): string {
  const raw = data.periodDuration ?? data.period ?? data.duration;
  if (typeof raw === "number" || typeof raw === "string") {
    return String(raw);
  }
  return "86400";
}

function readStart(data: Record<string, unknown>): string {
  const raw = data.startDate ?? data.start;
  if (typeof raw === "number" || typeof raw === "string") {
    return String(raw);
  }
  return "";
}

/**
 * Host EIP-7715 grant consent — editable period fields when adjustment allowed.
 */
export function GrantExecutionPermissionModal({
  request,
  onResolve,
  onReject,
}: {
  request: IGrantExecutionPermissionRequest;
  onResolve: (result: IGrantExecutionPermissionResult) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.grantExecutionPermission;
  const { account } = style.copy;
  const { listTrackedAssets, resolveChain } = useWallet();
  const permission = request.request.permission;
  const adjustable = permission.isAdjustmentAllowed !== false;
  const initialToken = readTokenAddress(permission.data);

  const [tokenOptions, setTokenOptions] = useState<
    Array<{ address: string; symbol: string; decimals: number; label: string }>
  >([]);
  const [tokenAddress, setTokenAddress] = useState(initialToken ?? "");
  const [amountText, setAmountText] = useState("");
  const [durationText, setDurationText] = useState(
    readDuration(permission.data),
  );
  const [startText, setStartText] = useState(readStart(permission.data));
  const [memo, setMemo] = useState("");
  const [initializedAmount, setInitializedAmount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void listTrackedAssets().then((assets) => {
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
        decimals: a.decimals ?? 18,
        label: `${a.symbol} (${a.name})`,
      }));
      if (
        initialToken &&
        !options.some(
          (o) => o.address.toLowerCase() === initialToken.toLowerCase(),
        )
      ) {
        try {
          options.unshift({
            address: getAddress(initialToken as `0x${string}`),
            symbol: "TOKEN",
            decimals: 18,
            label: initialToken,
          });
        } catch {
          // leave options as-is
        }
      }
      setTokenOptions(options);
      if (!tokenAddress && options[0]) {
        setTokenAddress(options[0].address);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    initialToken,
    listTrackedAssets,
    request.request.chainId,
    tokenAddress,
  ]);

  const selected = useMemo(() => {
    const match = tokenOptions.find(
      (o) => o.address.toLowerCase() === tokenAddress.toLowerCase(),
    );
    return match ?? { address: tokenAddress, symbol: "TOKEN", decimals: 18, label: tokenAddress };
  }, [tokenAddress, tokenOptions]);

  useEffect(() => {
    if (initializedAmount || !tokenAddress) return;
    const atoms = readAmountAtoms(permission.data);
    if (atoms !== null) {
      try {
        setAmountText(formatUnits(atoms, selected.decimals));
      } catch {
        setAmountText("");
      }
    }
    setInitializedAmount(true);
  }, [initializedAmount, permission.data, selected.decimals, tokenAddress]);

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

  const formReady =
    Boolean(tokenAddress) &&
    amountText.trim() !== "" &&
    amountError === null &&
    durationText.trim() !== "" &&
    durationError === null;

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
    const startTrimmed = startText.trim();
    const data: Record<string, unknown> = {
      tokenAddress: EVMAccountAddress(
        getAddress(tokenAddress as `0x${string}`),
      ),
      periodAmount: `0x${periodAmount.toString(16)}`,
      periodDuration,
    };
    if (startTrimmed) {
      data.startDate = Number(startTrimmed);
    }
    const nextPermission: IExecutionPermission = {
      type: ERC20_TOKEN_PERIODIC,
      isAdjustmentAllowed: permission.isAdjustmentAllowed,
      data,
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
          label: copy.grantLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !formReady,
          onClick: grant,
        },
      ]}
    >
      <p className="text-muted-foreground m-0 text-sm">{body}</p>
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
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grant-token">{copy.tokenLabel}</Label>
          {adjustable && tokenOptions.length > 0 ? (
            <select
              id="grant-token"
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
            <p className="m-0 break-all font-mono text-xs">{tokenAddress || "—"}</p>
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
          <Label htmlFor="grant-duration">{copy.periodDurationLabel}</Label>
          <Input
            id="grant-duration"
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
          <Label htmlFor="grant-start">{copy.startLabel}</Label>
          <Input
            id="grant-start"
            inputMode="numeric"
            disabled={!adjustable}
            value={startText}
            onChange={(event) => setStartText(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="grant-memo">{copy.memoLabel}</Label>
          <Textarea
            id="grant-memo"
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
