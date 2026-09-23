import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import { getAddress } from "viem";
import { ERC721_TRANSFER } from "../../../lib/interfaces/business/IDelegationService";
import { useStyle } from "../../../style/StyleProvider";
import { ConsentSummaryRow } from "../../ConsentSummaryRow";
import { PermissionGrantTermsCard } from "../PermissionGrantConsentLayout";
import {
  buildKitScopePermissionGrantResult,
  isKitScopePermissionGrantValid,
  readBigIntFromPermissionData,
  readTokenAddressFromData,
} from "./kitScopeTermsShared";

export function isErc721TransferPermissionValid(
  executionRequest: IExecutionPermissionRequest,
): boolean {
  return isKitScopePermissionGrantValid(ERC721_TRANSFER, executionRequest);
}

export function buildErc721TransferGrantResult(
  executionRequest: IExecutionPermissionRequest,
) {
  return buildKitScopePermissionGrantResult(
    ERC721_TRANSFER,
    executionRequest,
  );
}

export function Erc721TransferPermissionTerms({
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
  const tokenId = readBigIntFromPermissionData(permissionData, "tokenId");
  const contractLabel =
    contract !== null ? getAddress(contract as `0x${string}`) : "—";

  return (
    <PermissionGrantTermsCard kindLabel={copy.erc721TransferKindLabel}>
      <ConsentSummaryRow label={copy.nftContractLabel}>
        <span className="truncate text-sm font-medium">{contractLabel}</span>
      </ConsentSummaryRow>
      <ConsentSummaryRow label={copy.tokenIdLabel}>
        <span className="truncate text-sm font-medium">
          {tokenId !== null ? tokenId.toString() : "—"}
        </span>
      </ConsentSummaryRow>
    </PermissionGrantTermsCard>
  );
}
