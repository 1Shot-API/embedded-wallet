import { useEffect, useMemo, useState } from "react";
import { EVMAccountAddress, type IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { formatUnits, getAddress } from "viem";
import { parseLiFiSwapData } from "../../../lib/implementations/business/DelegationService";
import { LIFI_SWAP_PERIODIC } from "../../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../../lib/types/enum/EAssetType";
import {
  formatSlippageBpsLabel,
  formatUnixSecondsLabel,
  humanizePeriodDuration,
  readHostMemoOrJustification,
  readPermissionStartText,
  resolvePermissionEndUnixSeconds,
  truncateMiddle,
} from "../../../lib/utils/delegationDisplay";
import { resolveAssetIconUrl } from "../../../lib/utils/tokenIcons";
import { useStyle } from "../../../style/StyleProvider";
import type { IGrantExecutionPermissionResult } from "../../../wallet/modalTypes";
import { useWallet } from "../../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { SafeAssetImage } from "../../SafeAssetImage";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import { ExplorerAddressLink } from "./ExplorerAddressLink";

function readString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim();
    if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  }
  return "";
}

export function isLiFiSwapPermissionValid(
  executionRequest: IExecutionPermissionRequest,
  defaultSlippageBps: number,
): boolean {
  try {
    parseLiFiSwapData(executionRequest.permission.data, defaultSlippageBps);
    return true;
  } catch {
    return false;
  }
}

export function buildLiFiSwapGrantResult(
  executionRequest: IExecutionPermissionRequest,
): IGrantExecutionPermissionResult {
  const permissionData = executionRequest.permission.data as Record<string, unknown>;
  return {
    permission: {
      type: LIFI_SWAP_PERIODIC,
      isAdjustmentAllowed: executionRequest.permission.isAdjustmentAllowed,
      data: permissionData,
    },
    memo: readHostMemoOrJustification(permissionData),
  };
}

export function LiFiSwapPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantLiFiSwapPermission;
  const { listTrackedAssets, resolveChain, getKnownAsset, liFiUtils } =
    useWallet();
  const permissionData = executionRequest.permission.data as Record<string, unknown>;

  const parsedSwap = useMemo(() => {
    try {
      return parseLiFiSwapData(
        permissionData,
        liFiUtils.defaultSlippageBps,
      );
    } catch {
      return null;
    }
  }, [liFiUtils.defaultSlippageBps, permissionData]);

  const tokenAddress = parsedSwap
    ? getAddress(parsedSwap.tokenAddress)
    : readString(permissionData, "tokenAddress", "inputToken");

  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenIconUrl, setTokenIconUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;
    const chainId = executionRequest.chainId;
    let checksummed: `0x${string}`;
    try {
      checksummed = getAddress(tokenAddress as `0x${string}`);
    } catch {
      return;
    }

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

  const summaryAmount = useMemo(() => {
    if (!parsedSwap || parsedSwap.periodAmount <= 0n) return null;
    try {
      return `${formatUnits(parsedSwap.periodAmount, tokenDecimals)} ${tokenSymbol}`;
    } catch {
      return null;
    }
  }, [parsedSwap, tokenDecimals, tokenSymbol]);

  const summaryWindow = parsedSwap
    ? humanizePeriodDuration(parsedSwap.periodDuration)
    : "—";

  const slippageDisplay = parsedSwap
    ? formatSlippageBpsLabel(parsedSwap.slippageBps)
    : null;

  const startDisplay = formatUnixSecondsLabel(
    readPermissionStartText(permissionData) ||
      (parsedSwap ? String(parsedSwap.startDate) : undefined),
  );

  const endDisplay = formatUnixSecondsLabel(
    resolvePermissionEndUnixSeconds({
      rules: executionRequest.rules,
      permissionData,
    }) ?? undefined,
  );

  const sourceChain = resolveChain(executionRequest.chainId);

  const destChainIdRaw = readString(permissionData, "destinationChainId");
  const destChainHex =
    destChainIdRaw === ""
      ? null
      : destChainIdRaw.startsWith("0x") || destChainIdRaw.startsWith("0X")
        ? destChainIdRaw
        : /^\d+$/.test(destChainIdRaw)
          ? `0x${BigInt(destChainIdRaw).toString(16)}`
          : null;
  const destChain = destChainHex
    ? resolveChain(destChainHex as never)
    : undefined;
  const destinationLabel = destChain?.label ?? (destChainIdRaw || "—");

  const outputAssetId = readString(permissionData, "outputAssetId");
  const outputRecipient = readString(permissionData, "outputRecipient");
  const lifiDiamond = readString(permissionData, "lifiDiamond");
  const quoteSigner = readString(permissionData, "quoteSigner");

  const diamondExplorerUrl = lifiDiamond
    ? sourceChain?.addressExplorerUrl(lifiDiamond)
    : undefined;
  const quoteSignerExplorerUrl = quoteSigner
    ? sourceChain?.addressExplorerUrl(quoteSigner)
    : undefined;

  return (
    <PermissionGrantTermsCard
      kindLabel={copy.permissionKindLabel}
      intro={copy.quoteNote}
    >
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
      {slippageDisplay ? (
        <ConsentSummaryRow label={copy.slippageLabel}>
          <span className="truncate text-sm font-medium">{slippageDisplay}</span>
        </ConsentSummaryRow>
      ) : null}
      <ConsentSummaryRow label={copy.outputAssetLabel}>
        <span
          className="truncate font-mono text-sm font-medium"
          title={outputAssetId || undefined}
        >
          {outputAssetId ? truncateMiddle(outputAssetId) : "—"}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.outputRecipientLabel}>
        <span
          className="truncate font-mono text-sm font-medium"
          title={outputRecipient || undefined}
        >
          {outputRecipient ? truncateMiddle(outputRecipient) : "—"}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.destinationChainLabel}>
        {destChain?.logoUrl ? (
          <SafeAssetImage
            src={destChain.logoUrl}
            className="size-5 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="truncate text-sm font-medium">{destinationLabel}</span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.lifiDiamondLabel}>
        {lifiDiamond ? (
          <ExplorerAddressLink
            address={lifiDiamond}
            explorerUrl={diamondExplorerUrl}
            ariaLabel={`${copy.viewOnExplorerLabel}: ${lifiDiamond}`}
          />
        ) : (
          <span className="text-sm font-medium">—</span>
        )}
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.quoteSignerLabel}>
        {quoteSigner ? (
          <ExplorerAddressLink
            address={quoteSigner}
            explorerUrl={quoteSignerExplorerUrl}
            ariaLabel={`${copy.viewOnExplorerLabel}: ${quoteSigner}`}
          />
        ) : (
          <span className="text-sm font-medium">—</span>
        )}
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
