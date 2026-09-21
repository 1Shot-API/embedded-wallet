import { useMemo } from "react";
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
  PermissionGrantHostCard,
  PermissionGrantHostContextRows,
} from "./PermissionGrantConsentLayout";
import {
  buildPermissionGrantResult,
  PermissionGrantTermsSection,
  usePermissionBatchAllValid,
} from "./permissionGrantTerms";

/**
 * EIP-7715 grant consent for one or more permissions — one host card, stacked terms cards.
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

  const hostContext = request.items[0];
  if (!hostContext) {
    return null;
  }

  const chain = resolveChain(hostContext.request.chainId);
  const chainLabel = chain?.label ?? hostContext.chainName;
  const delegateAddress = String(hostContext.request.to);
  const delegateExplorerUrl = chain?.addressExplorerUrl(delegateAddress);

  const hostMessage = useMemo(() => {
    for (const item of request.items) {
      const message = readHostMemoOrJustification(
        item.request.permission.data as Record<string, unknown>,
      );
      if (message) return message;
    }
    return undefined;
  }, [request.items]);

  const allValid = usePermissionBatchAllValid(request.items);

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
        <PermissionGrantHostCard
          domain={request.domain}
          message={hostMessage}
        >
          <PermissionGrantHostContextRows
            toLabel={shellCopy.toLabel}
            chainLabel={shellCopy.chainLabel}
            viewOnExplorerLabel={shellCopy.viewOnExplorerLabel}
            delegateAddress={delegateAddress}
            delegateExplorerUrl={delegateExplorerUrl}
            chainLogoUrl={chain?.logoUrl}
            chainDisplayLabel={chainLabel}
          />
        </PermissionGrantHostCard>
        {request.items.map((item, index) => (
          <PermissionGrantTermsSection
            key={`${item.grantKind}-${index}`}
            grantKind={item.grantKind}
            executionRequest={item.request}
          />
        ))}
      </div>
    </Modal>
  );
}
