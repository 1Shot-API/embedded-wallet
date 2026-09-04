import { useEffect, useState } from "react";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
  type IExecutionPermission,
} from "@1shotapi/ows-types";
import { getAddress } from "viem";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LIFI_SWAP_APPROVE } from "../../lib/interfaces/business/IDelegationService";
import { EAssetType } from "../../lib/types/enum/EAssetType";
import { useStyle } from "../../style/StyleProvider";
import type {
  IGrantExecutionPermissionRequest,
  IGrantExecutionPermissionResult,
} from "../../wallet/modalTypes";
import { useWallet } from "../../wallet/WalletProvider";
import { Modal } from "../Modal";
import { CopyableText } from "../CopyableText";

function readString(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const raw = data[key];
    if (typeof raw === "string" && raw.trim() !== "") return raw;
  }
  return "";
}

/**
 * Host EIP-7715 LiFi approve onboarding consent — one-time approve(token, diamond).
 */
export function GrantLiFiApprovePermissionModal({
  request,
  onResolve,
  onReject,
}: {
  request: IGrantExecutionPermissionRequest;
  onResolve: (result: IGrantExecutionPermissionResult) => void;
  onReject: (error: unknown) => void;
}) {
  const { style } = useStyle();
  const copy = style.copy.grantLiFiApprovePermission;
  const { account } = style.copy;
  const { listTrackedAssets, resolveChain } = useWallet();
  const permission = request.request.permission;
  const adjustable = permission.isAdjustmentAllowed !== false;
  const data = permission.data;

  const initialToken = readString(data, "tokenAddress", "inputToken");
  const spender = readString(data, "spender", "lifiDiamond");
  const [tokenOptions, setTokenOptions] = useState<
    Array<{ address: string; symbol: string; label: string }>
  >([]);
  const [tokenAddress, setTokenAddress] = useState(initialToken);
  const [memo, setMemo] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listTrackedAssets().then((assets) => {
      if (cancelled) return;
      const onChain = assets.filter(
        (a) =>
          a.type === EAssetType.Erc20 &&
          String(a.chainId).toLowerCase() ===
            String(request.request.chainId).toLowerCase(),
      );
      const options = onChain.map((a) => ({
        address: getAddress(String(a.address)),
        symbol: a.symbol,
        label: `${a.symbol} (${a.name})`,
      }));
      if (
        initialToken &&
        !options.some(
          (o) => o.address.toLowerCase() === initialToken.toLowerCase(),
        )
      ) {
        try {
          options.unshift({
            address: getAddress(initialToken as `0x${string}`),
            symbol: "TOKEN",
            label: initialToken,
          });
        } catch {
          /* leave options as-is */
        }
      }
      setTokenOptions(options);
      if (!tokenAddress && options[0]) {
        setTokenAddress(options[0].address);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [
    initialToken,
    listTrackedAssets,
    request.request.chainId,
    tokenAddress,
  ]);

  const formReady = Boolean(tokenAddress) && Boolean(spender);

  const chainLabel =
    resolveChain(request.request.chainId)?.label ?? request.chainName;

  const body = copy.body
    .replace("{domain}", request.domain)
    .replace("{to}", request.request.to)
    .replace("{chainName}", chainLabel)
    .replace("{permissionType}", permission.type);

  const reject = () => {
    onReject(new OwsUserRejectedError("User rejected the permission request"));
  };

  const grant = () => {
    if (!formReady) return;
    const nextPermission: IExecutionPermission = {
      type: LIFI_SWAP_APPROVE,
      isAdjustmentAllowed: permission.isAdjustmentAllowed,
      data: {
        tokenAddress: EVMAccountAddress(
          getAddress(tokenAddress as `0x${string}`),
        ),
        spender: EVMAccountAddress(getAddress(spender as `0x${string}`)),
      },
    };
    onResolve({ permission: nextPermission, memo: memo.trim() });
  };

  return (
    <Modal
      title={copy.title}
      onBackdropDismiss={reject}
      actions={[
        {
          label: copy.rejectLabel,
          variant: "secondary",
          onClick: reject,
        },
        {
          label:
            request.batchIndex < request.batchCount - 1
              ? copy.nextLabel
              : copy.grantLabel,
          variant: "primary",
          autoFocus: true,
          disabled: !formReady,
          onClick: grant,
        },
      ]}
    >
      <p className="text-muted-foreground m-0 text-sm">{body}</p>
      <p className="text-destructive m-0 mt-2 text-xs" role="note">
        {copy.warning}
      </p>

      <dl className="mt-3 flex flex-col gap-2 text-sm">
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.hostLabel}
          </dt>
          <dd className="text-foreground m-0">{request.domain}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.toLabel}
          </dt>
          <dd className="m-0 min-w-0">
            <CopyableText
              text={request.request.to}
              truncate
              copyLabel={account.copyAddressLabel}
              copiedLabel={account.addressCopiedLabel}
              copyFailedLabel={account.addressCopyFailedLabel}
            />
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.chainLabel}
          </dt>
          <dd className="text-foreground m-0">{chainLabel}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.permissionTypeLabel}
          </dt>
          <dd className="text-foreground m-0 font-mono text-xs">
            {permission.type}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-muted-foreground text-xs font-medium uppercase">
            {copy.spenderLabel}
          </dt>
          <dd className="m-0 min-w-0 font-mono text-xs break-all">
            {spender || "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-approve-token">{copy.tokenLabel}</Label>
          {adjustable && tokenOptions.length > 0 ? (
            <select
              id="lifi-approve-token"
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              value={tokenAddress}
              onChange={(event) => setTokenAddress(event.target.value)}
            >
              {tokenOptions.map((option) => (
                <option key={option.address} value={option.address}>
                  {option.label}
                </option>
              ))}
            </select>
          ) : (
            <p className="m-0 break-all font-mono text-xs">
              {tokenAddress || "—"}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lifi-approve-memo">{copy.memoLabel}</Label>
          <Textarea
            id="lifi-approve-memo"
            placeholder={copy.memoPlaceholder}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            rows={2}
          />
        </div>
      </div>
    </Modal>
  );
}
