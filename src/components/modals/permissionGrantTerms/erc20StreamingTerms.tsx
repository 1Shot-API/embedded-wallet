import { useMemo } from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { getAddress } from "viem";
import { ERC20_STREAMING } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { SafeAssetImage } from "../../SafeAssetImage";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  formatBigIntAmountDisplay,
  formatStreamDurationSeconds,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
  readTokenAddressFromData,
  useErc20TokenDisplay,
} from "./kitScopeTermsShared";

export function isErc20StreamingPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(ERC20_STREAMING, executionRequest);
}

export function buildErc20StreamingGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    ERC20_STREAMING,
    executionRequest,
  );
}

export function Erc20StreamingPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const tokenAddress = readTokenAddressFromData(permissionData);
  const { tokenSymbol, tokenDecimals, tokenIconUrl } = useErc20TokenDisplay(
    executionRequest.chainId,
    tokenAddress,
  );
  const maxAmount = readBigIntFromPermissionData(permissionData, "maxAmount");
  const amountPerSecond = readBigIntFromPermissionData(
    permissionData,
    "amountPerSecond",
  );
  const summaryMax = useMemo(
    () => formatBigIntAmountDisplay(maxAmount, tokenDecimals, tokenSymbol),
    [maxAmount, tokenDecimals, tokenSymbol],
  );
  const streamDuration = useMemo(
    () => formatStreamDurationSeconds(maxAmount, amountPerSecond),
    [amountPerSecond, maxAmount],
  );
  const tokenLabel =
    tokenAddress !== null ? getAddress(tokenAddress as `0x${string}`) : "—";

  return (
    <PermissionGrantTermsCard kindLabel={copy.erc20StreamingKindLabel}>
      <ConsentSummaryRow label={copy.tokenLabel}>
        {tokenIconUrl ? (
          <SafeAssetImage
            src={tokenIconUrl}
            className="size-5 shrink-0 rounded-full object-cover"
          />
        ) : null}
        <span className="truncate text-sm font-medium">{tokenLabel}</span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.maxAmountLabel}>
        <span className="truncate text-sm font-medium">
          {summaryMax ?? "—"}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.streamDurationLabel}>
        <span className="truncate text-sm font-medium">
          {streamDuration ?? "—"}
        </span>
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
