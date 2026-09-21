import { useEffect, useMemo, useState } from "react";
import { EVMAccountAddress, type IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { getAddress } from "viem";
import {
  parseLiFiApproveData,
} from "../../../lib/implementations/business/DelegationService";
import { LIFI_SWAP_APPROVE } from "../../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../../lib/types/enum/EAssetType";
import { readHostMemoOrJustification } from "../../../lib/utils/delegationDisplay";
import { resolveAssetIconUrl } from "../../../lib/utils/tokenIcons";
import { useStyle } from "../../../style/StyleProvider";
import type { IGrantExecutionPermissionResult } from "../../../wallet/modalTypes";
import { useWallet } from "../../../wallet/WalletProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { SafeAssetImage } from "../../SafeAssetImage";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import { ExplorerAddressLink } from "./ExplorerAddressLink";

export function isLiFiApprovePermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  try {
    parseLiFiApproveData(executionRequest.permission.data);
    return true;
  } catch {
    return false;
  }
}

export function buildLiFiApproveGrantResult(
  executionRequest: IExecutionPermissionRequest,
): IGrantExecutionPermissionResult {
  const permissionData = executionRequest.permission.data as Record<string, unknown>;
  return {
    permission: {
      type: LIFI_SWAP_APPROVE,
      isAdjustmentAllowed: executionRequest.permission.isAdjustmentAllowed,
      data: permissionData,
    },
    memo: readHostMemoOrJustification(permissionData),
  };
}

export function LiFiApprovePermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantLiFiApprovePermission;
  const { listTrackedAssets, resolveChain, getKnownAsset } = useWallet();
  const permissionData = executionRequest.permission.data as Record<string, unknown>;

  const parsedApprove = useMemo(() => {
    try {
      return parseLiFiApproveData(permissionData);
    } catch {
      return null;
    }
  }, [permissionData]);

  const tokenAddress = parsedApprove
    ? String(parsedApprove.tokenAddress)
    : "";
  const spender = parsedApprove ? String(parsedApprove.spender) : "";

  const [tokenSymbol, setTokenSymbol] = useState("TOKEN");
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

  const chain = resolveChain(executionRequest.chainId);
  const spenderExplorerUrl = spender
    ? chain?.addressExplorerUrl(spender)
    : undefined;

  return (
    <PermissionGrantTermsCard
      kindLabel={copy.permissionKindLabel}
      intro={copy.warning}
    >
      <ConsentSummaryRow label={copy.tokenLabel}>
        {tokenIconUrl ? (
          <SafeAssetImage
            src={tokenIconUrl}
            className="size-5 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="truncate text-sm font-medium">
          {tokenAddress ? tokenSymbol : "—"}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.spenderLabel}>
        {spender ? (
          <ExplorerAddressLink
            address={spender}
            explorerUrl={spenderExplorerUrl}
            ariaLabel={`${copy.viewOnExplorerLabel}: ${spender}`}
          />
        ) : (
          <span className="text-sm font-medium">—</span>
        )}
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
