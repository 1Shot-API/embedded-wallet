import { useMemo } from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { NATIVE_PERIOD_TRANSFER } from "../../../lib/interfaces/business/IDelegationService";
import {
  readPermissionAmountAtoms,
} from "../../../lib/utils/delegationDisplay";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  formatBigIntAmountDisplay,
  formatPeriodWindow,
  formatStartRow,
  isKitScopePermissionGrantValid,
} from "./kitScopeTermsShared";

export function isNativePeriodTransferPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(
    NATIVE_PERIOD_TRANSFER,
    executionRequest,
  );
}

export function buildNativePeriodTransferGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    NATIVE_PERIOD_TRANSFER,
    executionRequest,
  );
}

export function NativePeriodTransferPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const amountAtoms = readPermissionAmountAtoms(permissionData);
  const summaryAmount = useMemo(
    () => formatBigIntAmountDisplay(amountAtoms, 18, "ETH"),
    [amountAtoms],
  );
  const resetPeriod = formatPeriodWindow(permissionData);
  const startDisplay = formatStartRow(permissionData);

  return (
    <PermissionGrantTermsCard kindLabel={copy.nativePeriodTransferKindLabel}>
      <ConsentSummaryRow label={copy.amountPerPeriodLabel}>
        <span className="truncate text-sm font-medium">
          {summaryAmount ?? "—"}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.resetPeriodLabel}>
        <span className="truncate text-sm font-medium">{resetPeriod}</span>
      </ConsentSummaryRow>
      {startDisplay ? (
        <ConsentSummaryRow label={copy.startsLabel}>
          <span className="truncate text-sm font-medium">{startDisplay}</span>
        </ConsentSummaryRow>
      ) : null}
    </PermissionGrantTermsCard>
  );
}
