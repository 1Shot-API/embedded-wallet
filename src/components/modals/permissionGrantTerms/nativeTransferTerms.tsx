import { useMemo } from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { NATIVE_TRANSFER_AMOUNT } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  formatBigIntAmountDisplay,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
} from "./kitScopeTermsShared";

export function isNativeTransferPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(
    NATIVE_TRANSFER_AMOUNT,
    executionRequest,
  );
}

export function buildNativeTransferGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    NATIVE_TRANSFER_AMOUNT,
    executionRequest,
  );
}

export function NativeTransferPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const maxAmount = readBigIntFromPermissionData(
    permissionData,
    "maxAmount",
    "amount",
  );
  const summaryMax = useMemo(
    () => formatBigIntAmountDisplay(maxAmount, 18, "ETH"),
    [maxAmount],
  );

  return (
    <PermissionGrantTermsCard kindLabel={copy.nativeTransferKindLabel}>
      <ConsentSummaryRow label={copy.maxAmountLabel}>
        <span className="truncate text-sm font-medium">
          {summaryMax ?? "—"}
        </span>
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
