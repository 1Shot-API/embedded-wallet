import type { EVMChainId } from "@1shotapi/ows-types";
import { Modal } from "../Modal";
import { useStyle } from "../../style";
import { DEMO_CHAINS } from "../../ows/demoChains";
import type { IAddAssetApprovalRequest } from "../../wallet/registerAddAsset";
import { CopyableText } from "../CopyableText";

function chainLabel(chainId: EVMChainId): string {
  return (
    DEMO_CHAINS.find((chain) => chain.chainId === chainId)?.label ?? chainId
  );
}

export function AddAssetModal({
  request,
  onResolve,
}: {
  request: IAddAssetApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { balances: copy } = style.copy;
  const displayName = request.assetSymbol || request.assetName;
  const network = chainLabel(request.chainId);

  return (
    <Modal
      title={copy.addConfirmTitle}
      onBackdropDismiss={() => onResolve(false)}
      actions={[
        {
          label: copy.addConfirmRejectLabel,
          variant: "secondary",
          onClick: () => onResolve(false),
        },
        {
          label: copy.addConfirmAcceptLabel,
          variant: "primary",
          autoFocus: true,
          onClick: () => onResolve(true),
        },
      ]}
    >
      <p className="text-muted-foreground m-0">
        {copy.addConfirmBody
          .replace("{assetName}", displayName)
          .replace("{chainLabel}", network)}
      </p>
      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.assetColumn}
          </dt>
          <dd className="text-foreground m-0 font-medium">{displayName}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.chainColumn}
          </dt>
          <dd className="text-foreground m-0">{network}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            Address
          </dt>
          <dd className="m-0 min-w-0">
            <CopyableText
              text={request.assetAddress}
              truncate
              copyLabel="Copy address"
              copiedLabel="Copied"
              copyFailedLabel="Copy failed"
            />
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
