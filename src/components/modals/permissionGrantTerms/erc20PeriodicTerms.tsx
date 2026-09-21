import { useEffect, useMemo, useState } from "react";
import { EVMAccountAddress, type IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { formatUnits, getAddress } from "viem";
import { ERC20_TOKEN_PERIODIC } from "../../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../../lib/types/enum/EAssetType";
import {
  formatUnixSecondsLabel,
  humanizePeriodDuration,
  parsePeriodDurationSeconds,
  readHostMemoOrJustification,
  readPermissionAmountAtoms,
  readPermissionPeriodDurationText,
  readPermissionStartText,
  resolvePermissionEndUnixSeconds,
} from "../../../lib/utils/delegationDisplay";
import { resolveAssetIconUrl } from "../../../lib/utils/tokenIcons";
import { useStyle } from "../../../style/StyleProvider";
import type { IGrantExecutionPermissionResult } from "../../../wallet/modalTypes";
import { useWallet } from "../../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { SafeAssetImage } from "../../SafeAssetImage";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";

function readTokenAddress(data: Record<string, unknown>): string | null {
  const raw = data.tokenAddress ?? data.token;
  return typeof raw === "string" ? raw : null;
}

export function isErc20PeriodicPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  const permissionData = executionRequest.permission.data as Record<string, unknown>;
  const tokenAddress = readTokenAddress(permissionData);
  const amountAtoms = readPermissionAmountAtoms(permissionData);
  const durationSeconds = parsePeriodDurationSeconds(
    readPermissionPeriodDurationText(permissionData),
  );
  return (
    Boolean(tokenAddress) &&
    amountAtoms !== null &&
    amountAtoms > 0n &&
    durationSeconds !== null
  );
}

export function buildErc20PeriodicGrantResult(
  executionRequest: IExecutionPermissionRequest,
): IGrantExecutionPermissionResult {
  const permissionData = executionRequest.permission.data as Record<string, unknown>;
  return {
    permission: {
      type: ERC20_TOKEN_PERIODIC,
      isAdjustmentAllowed: executionRequest.permission.isAdjustmentAllowed,
      data: permissionData,
    },
    memo: readHostMemoOrJustification(permissionData),
  };
}

export function Erc20PeriodicPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantExecutionPermission;
  const { listTrackedAssets, getKnownAsset } = useWallet();
  const permissionData = executionRequest.permission.data as Record<string, unknown>;
  const tokenAddress = readTokenAddress(permissionData);

  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenIconUrl, setTokenIconUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;
    const chainId = executionRequest.chainId;
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
  }, [executionRequest.chainId, getKnownAsset, listTrackedAssets, tokenAddress]);

  const amountAtoms = readPermissionAmountAtoms(permissionData);
  const durationSeconds = parsePeriodDurationSeconds(
    readPermissionPeriodDurationText(permissionData),
  );
  const startDisplay = formatUnixSecondsLabel(
    readPermissionStartText(permissionData) || undefined,
  );
  const endDisplay = formatUnixSecondsLabel(
    resolvePermissionEndUnixSeconds({
      rules: executionRequest.rules,
      permissionData,
    }) ?? undefined,
  );

  const summaryAmount = useMemo(() => {
    if (amountAtoms === null || amountAtoms <= 0n) return null;
    try {
      return `${formatUnits(amountAtoms, tokenDecimals)} ${tokenSymbol}`;
    } catch {
      return null;
    }
  }, [amountAtoms, tokenDecimals, tokenSymbol]);

  const summaryWindow =
    durationSeconds === null
      ? "—"
      : humanizePeriodDuration(durationSeconds);

  return (
    <PermissionGrantTermsCard kindLabel={copy.permissionKindLabel}>
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
      {endDisplay ? (
        <ConsentSummaryRow label={copy.endLabel}>
          <span className="truncate text-sm font-medium">{endDisplay}</span>
        </ConsentSummaryRow>
      ) : null}
    </PermissionGrantTermsCard>
  );
}
