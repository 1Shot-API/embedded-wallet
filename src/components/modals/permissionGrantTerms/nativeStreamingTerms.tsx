import { useMemo } from "react";
import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { NATIVE_STREAMING } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  formatBigIntAmountDisplay,
  formatStreamDurationSeconds,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
} from "./kitScopeTermsShared";

export function isNativeStreamingPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(NATIVE_STREAMING, executionRequest);
}

export function buildNativeStreamingGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    NATIVE_STREAMING,
    executionRequest,
  );
}

export function NativeStreamingPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const maxAmount = readBigIntFromPermissionData(permissionData, "maxAmount");
  const initialAmount = readBigIntFromPermissionData(
    permissionData,
    "initialAmount",
  );
  const amountPerSecond = readBigIntFromPermissionData(
    permissionData,
    "amountPerSecond",
  );
  const summaryMax = useMemo(
    () => formatBigIntAmountDisplay(maxAmount, 18, "ETH"),
    [maxAmount],
  );
  const streamDuration = useMemo(
    () =>
      formatStreamDurationSeconds(maxAmount, amountPerSecond, initialAmount),
    [amountPerSecond, initialAmount, maxAmount],
  );

  return (
    <PermissionGrantTermsCard kindLabel={copy.nativeStreamingKindLabel}>
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
