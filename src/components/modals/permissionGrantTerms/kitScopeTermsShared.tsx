import { useEffect, useState } from "react";
import {
  EVMAccountAddress,
  type IExecutionPermissionRequest,
} from "@1shotapi/ows-types";
import { formatUnits, getAddress } from "viem";
import type { ExecutionPermissionType } from "../../../lib/interfaces/business/IDelegationService";
import { validateKitScopeRequest } from "../../../lib/implementations/business/kitScopePermissions";
import { EAssetType } from "../../../lib/types/enum/EAssetType";
import {
  formatUnixSecondsLabel,
  humanizePeriodDuration,
  humanizeStreamDuration,
  parsePeriodDurationSeconds,
  readHostMemoOrJustification,
  readPermissionPeriodDurationText,
  readPermissionStartText,
} from "../../../lib/utils/delegationDisplay";
import { resolveAssetIconUrl } from "../../../lib/utils/tokenIcons";
import type { IGrantExecutionPermissionResult } from "../../../wallet/modalTypes";
import { useWallet } from "../../../wallet/WalletProvider";
import { isAppendedCaveatValid } from "./appendedCaveatUtils";

export function isKitScopePermissionGrantValid(
  permissionType: string,
  executionRequest: IExecutionPermissionRequest,
): boolean {
  const data = executionRequest.permission.data as Record<string, unknown>;
  if (!validateKitScopeRequest(permissionType, data)) return false;
  const appendedCaveats = executionRequest.caveats ?? [];
  return appendedCaveats.every((caveat) => isAppendedCaveatValid(caveat));
}

export function buildKitScopePermissionGrantResult(
  permissionType: ExecutionPermissionType,
  executionRequest: IExecutionPermissionRequest,
): IGrantExecutionPermissionResult {
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  return {
    permission: {
      type: permissionType,
      isAdjustmentAllowed: executionRequest.permission.isAdjustmentAllowed,
      data: permissionData,
    },
    memo: readHostMemoOrJustification(permissionData),
  };
}

export function readTokenAddressFromData(
  data: Record<string, unknown>,
): string | null {
  const raw = data.tokenAddress ?? data.token ?? data.contractAddress;
  return typeof raw === "string" ? raw : null;
}

export function formatBigIntAmountDisplay(
  atoms: bigint | null,
  decimals: number,
  symbol: string,
): string | null {
  if (atoms === null || atoms <= 0n) return null;
  try {
    return `${formatUnits(atoms, decimals)} ${symbol}`;
  } catch {
    return null;
  }
}

export function readBigIntFromPermissionData(
  data: Record<string, unknown>,
  ...keys: string[]
): bigint | null {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "bigint") return raw;
    if (typeof raw === "number" && Number.isFinite(raw)) return BigInt(raw);
    if (typeof raw === "string" && raw.trim() !== "") {
      const trimmed = raw.trim();
      try {
        return trimmed.startsWith("0x") ? BigInt(trimmed) : BigInt(trimmed);
      } catch {
        continue;
      }
    }
  }
  return null;
}

export function formatPeriodWindow(data: Record<string, unknown>): string {
  const durationSeconds = parsePeriodDurationSeconds(
    readPermissionPeriodDurationText(data),
  );
  if (durationSeconds === null) return "—";
  return humanizePeriodDuration(durationSeconds);
}

export function formatStartRow(data: Record<string, unknown>): string | null {
  return formatUnixSecondsLabel(readPermissionStartText(data) || undefined);
}

export function formatStreamDurationSeconds(
  maxAmount: bigint | null,
  amountPerSecond: bigint | null,
  initialAmount: bigint | null = 0n,
): string | null {
  if (
    maxAmount === null ||
    amountPerSecond === null ||
    maxAmount <= 0n ||
    amountPerSecond <= 0n
  ) {
    return null;
  }
  const streamable = maxAmount - (initialAmount ?? 0n);
  if (streamable <= 0n) return null;
  const seconds = streamable / amountPerSecond;
  if (seconds <= 0n) return null;
  const n = Number(seconds);
  if (!Number.isFinite(n)) return null;
  return humanizeStreamDuration(n);
}

export function useErc20TokenDisplay(
  chainId: IExecutionPermissionRequest["chainId"],
  tokenAddress: string | null,
) {
  const { listTrackedAssets, getKnownAsset } = useWallet();
  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
  const [tokenDecimals, setTokenDecimals] = useState(6);
  const [tokenIconUrl, setTokenIconUrl] = useState<string | undefined>();

  useEffect(() => {
    if (!tokenAddress) return;
    let cancelled = false;
    const checksummed = getAddress(tokenAddress as `0x${string}`);

    void (async () => {
      const assets = await listTrackedAssets();
      if (cancelled) return;
      const tracked = assets.find(
        (a) =>
          a.type === EAssetType.Erc20 &&
          String(a.chainId).toLowerCase() === String(chainId).toLowerCase() &&
          getAddress(String(a.address)).toLowerCase() ===
            checksummed.toLowerCase(),
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
  }, [chainId, getKnownAsset, listTrackedAssets, tokenAddress]);

  return { tokenSymbol, tokenDecimals, tokenIconUrl };
}
