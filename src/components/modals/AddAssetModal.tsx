import { Modal } from "../Modal";
import { useStyle } from "../../style/StyleProvider";
import { useWallet } from "../../wallet/WalletProvider";
import type { IAddAssetApprovalRequest } from "../../wallet/registerAddAsset";
import { CopyableText } from "../CopyableText";

export function AddAssetModal({
  request,
  onResolve,
}: {
  request: IAddAssetApprovalRequest;
  onResolve: (approved: boolean) => void;
}) {
  const { style } = useStyle();
  const { resolveChain } = useWallet();
  const { balances: copy, account } = style.copy;
  const displayName = request.assetSymbol || request.assetName;
  const network =
    resolveChain(request.chainId)?.label ??
    String(request.chainId);

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
            {copy.addressLabel}
          </dt>
          <dd className="m-0 min-w-0">
            <CopyableText
              text={request.assetAddress}
              truncate
              copyLabel={account.copyAddressLabel}
              copiedLabel={account.addressCopiedLabel}
              copyFailedLabel={account.addressCopyFailedLabel}
            />
          </dd>
        </div>
      </dl>
    </Modal>
  );
}
