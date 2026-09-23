import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { formatUnits, getAddress } from "viem";
import { FUNCTION_CALL } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
} from "./kitScopeTermsShared";

function formatAddressList(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "—";
  return raw
    .map((entry) =>
      typeof entry === "string"
        ? getAddress(entry as `0x${string}`)
        : String(entry),
    )
    .join(", ");
}

function formatSelectorList(raw: unknown): string {
  if (!Array.isArray(raw) || raw.length === 0) return "—";
  return raw.map(String).join(", ");
}

function formatAllowedCalldataRow(entry: unknown, index: number): string {
  if (typeof entry !== "object" || entry === null) return `#${index}`;
  const row = entry as Record<string, unknown>;
  return `@${row.startIndex}: ${String(row.value ?? "")}`;
}

function formatExactCalldata(exact: unknown): string | null {
  if (typeof exact === "string") return exact;
  if (typeof exact === "object" && exact !== null) {
    const calldata = (exact as Record<string, unknown>).calldata;
    if (typeof calldata === "string") return calldata;
  }
  return null;
}

function formatPinnedParameters(data: Record<string, unknown>): string {
  const allowed = data.allowedCalldata;
  if (Array.isArray(allowed) && allowed.length > 0) {
    return allowed.map(formatAllowedCalldataRow).join("; ");
  }
  return formatExactCalldata(data.exactCalldata) ?? "—";
}

export function isFunctionCallPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(FUNCTION_CALL, executionRequest);
}

export function buildFunctionCallGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(FUNCTION_CALL, executionRequest);
}

export function FunctionCallPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const maxValue = readBigIntFromPermissionData(
    permissionData,
    "maxValue",
    "valueLte",
  );
  const maxValueDisplay =
    maxValue !== null ? `${formatUnits(maxValue, 18)} ETH` : "—";

  return (
    <PermissionGrantTermsCard kindLabel={copy.functionCallKindLabel}>
      <ConsentSummaryRow label={copy.allowedContractsLabel}>
        <span className="break-all text-sm font-medium">
          {formatAddressList(permissionData.targets)}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.allowedFunctionsLabel}>
        <span className="break-all text-sm font-medium">
          {formatSelectorList(permissionData.selectors ?? permissionData.methods)}
        </span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.maxValueLabel}>
        <span className="truncate text-sm font-medium">{maxValueDisplay}</span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.pinnedParametersLabel}>
        <span className="break-all text-sm font-medium">
          {formatPinnedParameters(permissionData)}
        </span>
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
