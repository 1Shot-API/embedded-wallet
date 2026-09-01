import { InfoIcon } from "lucide-react";
import { Modal } from "../Modal";
import { AssetIdentityMark } from "../AssetIdentityMark";
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
  const chain = resolveChain(request.chainId);
  const network = chain?.label ?? String(request.chainId);

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
      <div className="text-foreground flex flex-col gap-5">
        <p className="text-muted-foreground m-0 text-sm leading-relaxed">
          {copy.addConfirmBody}
        </p>

        <div className="flex items-center gap-4">
          <AssetIdentityMark
            chainId={request.chainId}
            address={request.assetAddress}
            symbol={request.assetSymbol}
            iconUrl={request.iconUrl}
            chainLogoUrl={chain?.logoUrl}
          />
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-xl font-semibold tracking-tight">
              {displayName}
            </span>
            <span className="bg-muted text-muted-foreground w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide">
              {network}
            </span>
            {request.iconUrl ? (
              <span className="text-muted-foreground text-xs">
                Host-provided icon
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {copy.addressLabel}
          </span>
          <CopyableText
            text={request.assetAddress}
            truncate
            copyLabel={account.copyAddressLabel}
            copiedLabel={account.addressCopiedLabel}
            copyFailedLabel={account.addressCopyFailedLabel}
          />
        </div>

        <div className="bg-primary/5 flex gap-2.5 rounded-xl px-3 py-3 text-sm leading-relaxed">
          <InfoIcon
            className="text-primary mt-0.5 size-4 shrink-0"
            aria-hidden
          />
          <p className="text-muted-foreground m-0">{copy.addConfirmWarning}</p>
        </div>
      </div>
    </Modal>
  );
}
