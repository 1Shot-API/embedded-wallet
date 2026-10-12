import { OwsUserRejectedError } from "@1shotapi/ows-types";

import { readHostMemoOrJustification } from "../../lib/utils/delegationDisplay";
import { useStyle } from "../../style/StyleProvider";
import type {
  IGrantExecutionPermissionResult,
  IGrantExecutionPermissionsBatchRequest,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";

import {
  PermissionGrantDelegationCard,
  PermissionGrantHostCard,
} from "./PermissionGrantConsentLayout";
import {
  buildPermissionGrantResult,
  PermissionGrantTermsSection,
  usePermissionBatchAllValid,
} from "./permissionGrantTerms";

/**
 * EIP-7715 grant consent for one or more permissions — host once, then one
 * card per requested delegation (delegate + chain + permission + rules).
 */
export function GrantPermissionConsentModal({
  request,
  onResolve,
  onReject,
}: {
  request: IGrantExecutionPermissionsBatchRequest;
  onResolve: (results: IGrantExecutionPermissionResult[]) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const shellCopy = style.copy.grantExecutionPermission;
  const { resolveChain } = useWallet();

  const allValid = usePermissionBatchAllValid(request.items);

  if (request.items.length === 0) {
    return null;
  }

  const reject = () => {
    onReject(new OwsUserRejectedError("User rejected the permission request"));
  };

  const grant = () => {
    if (!allValid) return;
    onResolve(
      request.items.map((item) =>
        buildPermissionGrantResult(item.grantKind, item.request),
      ),
    );
  };

  return (
    <Modal
      title={shellCopy.title}
      onBackdropDismiss={reject}
      actions={[
        {
          label: shellCopy.rejectLabel,
          variant: "secondary",
          onClick: reject,
        },
        {
          label: shellCopy.grantLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !allValid,
          onClick: grant,
        },
      ]}
    >
      <div className="flex flex-col gap-3">
        <PermissionGrantHostCard domain={request.domain} />
        {request.items.map((item, index) => {
          const chain = resolveChain(item.request.chainId);
          const chainLabel = chain?.label ?? item.chainName;
          const delegateAddress = String(item.request.to);
          const delegateExplorerUrl =
            chain?.addressExplorerUrl(delegateAddress);
          const message = readHostMemoOrJustification(
            item.request.permission.data as Record<string, unknown>,
          );
          return (
            <PermissionGrantDelegationCard
              key={`${item.grantKind}-${item.request.chainId}-${index}`}
              toLabel={shellCopy.toLabel}
              chainLabel={shellCopy.chainLabel}
              viewOnExplorerLabel={shellCopy.viewOnExplorerLabel}
              delegateAddress={delegateAddress}
              delegateExplorerUrl={delegateExplorerUrl}
              chainLogoUrl={chain?.logoUrl}
              chainDisplayLabel={chainLabel}
              message={message || undefined}
            >
              <PermissionGrantTermsSection
                grantKind={item.grantKind}
                executionRequest={item.request}
              />
            </PermissionGrantDelegationCard>
          );
        })}
      </div>
    </Modal>
  );
}
