import { useEffect, useMemo, useState } from "react";
import { ExternalLinkIcon } from "lucide-react";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type IExecutionPermission,
} from "@1shotapi/ows-types";
import { formatUnits, getAddress, hexToBigInt } from "viem";
import { ERC20_TOKEN_PERIODIC } from "../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import {
  formatUnixSecondsLabel,
  humanizePeriodDuration,
  parsePeriodDurationSeconds,
} from "../../lib/utils/delegationDisplay";
import { faviconUrl, truncateAddress } from "../../lib/utils/identityDisplay";
import { resolveAssetIconUrl } from "../../lib/utils/tokenIcons";
import { useStyle } from "../../style/StyleProvider";
import type {
  IGrantExecutionPermissionRequest,
  IGrantExecutionPermissionResult,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../ConsentSummaryRow";
import { Modal } from "../Modal";
import { SafeAssetImage } from "../SafeAssetImage";

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

function readHostMemoOrJustification(data: Record<string, unknown>): string {
  const memo = data.memo;
  if (typeof memo === "string" && memo.trim()) {
    return memo.trim();
  }
  const justification = data.justification;
  if (typeof justification === "string" && justification.trim()) {
    return justification.trim();
  }
  return "";
}

function readDuration(data: Record<string, unknown>): string {
  const raw = data.periodDuration ?? data.period ?? data.duration;
  if (typeof raw === "number" || typeof raw === "string") {
    return String(raw);
  }
  return "";
}

function readStart(data: Record<string, unknown>): string {
  const raw = data.startDate ?? data.start;
  if (typeof raw === "number" || typeof raw === "string") {
    return String(raw);
  }
  return "";
}

/**
 * Host EIP-7715 grant consent — read-only terms; user grants or rejects as proposed.
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
  const { listTrackedAssets, resolveChain, getKnownAsset } = useWallet();
  const permission = request.request.permission;
  const permissionData = permission.data as Record<string, unknown>;
  const tokenAddress = readTokenAddress(permissionData);
  const hostMessage = readHostMemoOrJustification(permissionData);

  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenIconUrl, setTokenIconUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;
    const chainId = request.request.chainId;
    const checksummed = getAddress(tokenAddress as `0x${string}`);

    void (async () => {
      const assets = await listTrackedAssets();
      if (cancelled) return;
      const tracked = assets.find(
        (a) =>
          a.type === EAssetType.Erc20 &&
          String(a.chainId).toLowerCase() === String(chainId).toLowerCase() &&
          getAddress(String(a.address)).toLowerCase() === checksummed.toLowerCase(),
      );
      if (tracked) {
        setTokenSymbol(tracked.symbol);
        setTokenDecimals(tracked.decimals ?? 6);
        setTokenIconUrl(
          resolveAssetIconUrl(
            chainId,
            EVMAccountAddress(checksummed),
            tracked.symbol,
            tracked.iconUrl,
          ),
        );
        return;
      }
      try {
        const known = await getKnownAsset(
          chainId,
          EVMAccountAddress(checksummed),
        );
        if (cancelled) return;
        if (known) {
          setTokenSymbol(known.symbol);
          setTokenDecimals(known.decimals ?? 6);
          setTokenIconUrl(
            resolveAssetIconUrl(
              chainId,
              EVMAccountAddress(checksummed),
              known.symbol,
              known.iconUrl,
            ),
          );
        } else {
          setTokenIconUrl(undefined);
        }
      } catch {
        setTokenIconUrl(undefined);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    getKnownAsset,
    listTrackedAssets,
    request.request.chainId,
    tokenAddress,
  ]);

  const amountAtoms = readAmountAtoms(permissionData);
  const durationSeconds = parsePeriodDurationSeconds(
    readDuration(permissionData),
  );
  const startDisplay = formatUnixSecondsLabel(
    readStart(permissionData) || undefined,
  );

  const summaryAmount = useMemo(() => {
    if (amountAtoms === null || amountAtoms <= 0n) return null;
    try {
      const amount = formatUnits(amountAtoms, tokenDecimals);
      return `${amount} ${tokenSymbol}`;
    } catch {
      return null;
    }
  }, [amountAtoms, tokenDecimals, tokenSymbol]);

  const summaryWindow =
    durationSeconds === null
      ? "—"
      : humanizePeriodDuration(durationSeconds);

  const termsValid =
    Boolean(tokenAddress) &&
    amountAtoms !== null &&
    amountAtoms > 0n &&
    durationSeconds !== null;

  const chain = resolveChain(request.request.chainId);
  const chainLabel = chain?.label ?? request.chainName;
  const delegateAddress = String(request.request.to);
  const delegateExplorerUrl = chain?.addressExplorerUrl(delegateAddress);

  const reject = () => {
    onReject(new OwsUserRejectedError("User rejected the permission request"));
  };

  const grant = () => {
    if (!termsValid) return;
    const nextPermission: IExecutionPermission = {
      type: ERC20_TOKEN_PERIODIC,
      isAdjustmentAllowed: permission.isAdjustmentAllowed,
      data: permissionData,
    };
    onResolve({
      permission: nextPermission,
      memo: hostMessage,
    });
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
          disabled: !termsValid,
          onClick: grant,
        },
      ]}
    >
      <div className="border-border flex flex-col gap-2.5 rounded-md border px-3 py-2.5">
        <p className="text-primary m-0 text-[0.65rem] font-semibold tracking-wide uppercase">
          {copy.permissionKindLabel}
        </p>
        <div className="flex min-w-0 items-center gap-2">
          <SafeAssetImage
            src={faviconUrl(request.domain)}
            className="size-4 shrink-0 rounded-sm"
          />
          <span className="truncate text-sm font-semibold" title={request.domain}>
            {request.domain}
          </span>
        </div>
        {hostMessage ? (
          <p className="text-muted-foreground m-0 text-sm leading-snug text-pretty">
            {hostMessage}
          </p>
        ) : null}
        <dl className="border-border m-0 flex flex-col gap-2.5 border-t pt-2.5">
          <ConsentSummaryRow label={copy.amountLabel}>
            {tokenIconUrl ? (
              <SafeAssetImage
                src={tokenIconUrl}
                className="size-5 shrink-0 rounded-full object-cover"
              />
            ) : null}
            <span className="truncate text-sm font-medium">
              {summaryAmount ?? "—"}
            </span>
          </ConsentSummaryRow>
          <ConsentSummaryRow label={copy.transferWindowLabel}>
            <span className="truncate text-sm font-medium">{summaryWindow}</span>
          </ConsentSummaryRow>
          {startDisplay ? (
            <ConsentSummaryRow label={copy.startLabel}>
              <span className="truncate text-sm font-medium">{startDisplay}</span>
            </ConsentSummaryRow>
          ) : null}
          <ConsentSummaryRow label={copy.toLabel}>
            {delegateExplorerUrl ? (
              <a
                href={delegateExplorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary flex min-w-0 items-center gap-1 font-mono text-sm underline underline-offset-2"
                title={delegateAddress}
                aria-label={`${copy.viewOnExplorerLabel}: ${delegateAddress}`}
              >
                <span className="truncate">
                  {truncateAddress(delegateAddress)}
                </span>
                <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
              </a>
            ) : (
              <span
                className="truncate font-mono text-sm"
                title={delegateAddress}
              >
                {truncateAddress(delegateAddress)}
              </span>
            )}
          </ConsentSummaryRow>
          <ConsentSummaryRow label={copy.chainLabel}>
            <SafeAssetImage
              src={chain?.logoUrl}
              className="size-5 shrink-0 rounded-full object-cover"
            />
            <span className="truncate text-sm font-medium">{chainLabel}</span>
          </ConsentSummaryRow>
        </dl>
      </div>
    </Modal>
  );
}
