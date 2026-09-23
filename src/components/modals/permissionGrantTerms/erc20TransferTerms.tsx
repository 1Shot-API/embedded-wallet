import { useMemo } from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { ERC20_TRANSFER_AMOUNT } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { SafeAssetImage } from "../../SafeAssetImage";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  formatBigIntAmountDisplay,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
  readTokenAddressFromData,
  useErc20TokenDisplay,
} from "./kitScopeTermsShared";

export function isErc20TransferPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(
    ERC20_TRANSFER_AMOUNT,
    executionRequest,
  );
}

export function buildErc20TransferGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    ERC20_TRANSFER_AMOUNT,
    executionRequest,
  );
}

export function Erc20TransferPermissionTerms({
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
  const maxAmount = readBigIntFromPermissionData(
    permissionData,
    "maxAmount",
    "amount",
  );
  const summaryMax = useMemo(
    () => formatBigIntAmountDisplay(maxAmount, tokenDecimals, tokenSymbol),
    [maxAmount, tokenDecimals, tokenSymbol],
  );
  const tokenLabel = tokenSymbol;

  return (
    <PermissionGrantTermsCard kindLabel={copy.erc20TransferKindLabel}>
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
    </PermissionGrantTermsCard>
  );
}
