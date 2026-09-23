import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { getAddress } from "viem";
import { OWNERSHIP_TRANSFER } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  isKitScopePermissionGrantValid,
  readTokenAddressFromData,
} from "./kitScopeTermsShared";

export function isOwnershipTransferPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(
    OWNERSHIP_TRANSFER,
    executionRequest,
  );
}

export function buildOwnershipTransferGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    OWNERSHIP_TRANSFER,
    executionRequest,
  );
}

export function OwnershipTransferPermissionTerms({
  executionRequest,
}: {
  executionRequest: IExecutionPermissionRequest;
}) {
  const copy = useStyle().style.copy.grantKitScopeTerms;
  const permissionData = executionRequest.permission.data as Record<
    string,
    unknown
  >;
  const contract = readTokenAddressFromData(permissionData);
  const newOwnerRaw = permissionData.newOwner;
  const contractLabel =
    contract !== null ? getAddress(contract as `0x${string}`) : "—";
  const newOwnerLabel =
    typeof newOwnerRaw === "string"
      ? getAddress(newOwnerRaw as `0x${string}`)
      : copy.newOwnerAnyLabel;

  return (
    <PermissionGrantTermsCard kindLabel={copy.ownershipTransferKindLabel}>
      <p className="text-sm text-destructive">{copy.ownershipWarning}</p>
      <ConsentSummaryRow label={copy.contractLabel}>
        <span className="truncate text-sm font-medium">{contractLabel}</span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.newOwnerLabel}>
        <span className="truncate text-sm font-medium">{newOwnerLabel}</span>
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
