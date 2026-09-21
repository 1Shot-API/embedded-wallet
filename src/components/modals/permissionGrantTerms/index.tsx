import type { IExecutionPermissionRequest } from "@1shotapi/ows-types";
import {
  LIFI_SWAP_APPROVE,
  LIFI_SWAP_PERIODIC,
  ERC20_TOKEN_PERIODIC,
} from "../../../lib/interfaces/business/IDelegationService";
import type {
  GrantPermissionModalKind,
  IGrantExecutionPermissionResult,
} from "../../../wallet/modalTypes";
import { useWallet } from "../../../wallet/WalletProvider";
import {
  buildErc20PeriodicGrantResult,
  Erc20PeriodicPermissionTerms,
  isErc20PeriodicPermissionValid,
} from "./erc20PeriodicTerms";
import {
  buildLiFiApproveGrantResult,
  isLiFiApprovePermissionValid,
  LiFiApprovePermissionTerms,
} from "./lifiApproveTerms";
import {
  buildLiFiSwapGrantResult,
  isLiFiSwapPermissionValid,
  LiFiSwapPermissionTerms,
} from "./lifiSwapTerms";

export function PermissionGrantTermsSection({
  grantKind,
  executionRequest,
}: {
  grantKind: GrantPermissionModalKind;
  executionRequest: IExecutionPermissionRequest;
}) {
  switch (grantKind) {
    case "grantExecutionPermission":
      return (
        <Erc20PeriodicPermissionTerms executionRequest={executionRequest} />
      );
    case "grantLiFiSwapPermission":
      return <LiFiSwapPermissionTerms executionRequest={executionRequest} />;
    case "grantLiFiApprovePermission":
      return <LiFiApprovePermissionTerms executionRequest={executionRequest} />;
    default: {
      const _exhaustive: never = grantKind;
      return _exhaustive;
    }
  }
}

export function isPermissionGrantItemValid(
  grantKind: GrantPermissionModalKind,
  executionRequest: IExecutionPermissionRequest,
  defaultSlippageBps: number,
): boolean {
  const permissionType = executionRequest.permission.type;
  switch (grantKind) {
    case "grantExecutionPermission":
      return (
        permissionType === ERC20_TOKEN_PERIODIC &&
        isErc20PeriodicPermissionValid(executionRequest)
      );
    case "grantLiFiSwapPermission":
      return (
        permissionType === LIFI_SWAP_PERIODIC &&
        isLiFiSwapPermissionValid(executionRequest, defaultSlippageBps)
      );
    case "grantLiFiApprovePermission":
      return (
        permissionType === LIFI_SWAP_APPROVE &&
        isLiFiApprovePermissionValid(executionRequest)
      );
    default: {
      const _exhaustive: never = grantKind;
      return _exhaustive;
    }
  }
}

export function buildPermissionGrantResult(
  grantKind: GrantPermissionModalKind,
  executionRequest: IExecutionPermissionRequest,
): IGrantExecutionPermissionResult {
  switch (grantKind) {
    case "grantExecutionPermission":
      return buildErc20PeriodicGrantResult(executionRequest);
    case "grantLiFiSwapPermission":
      return buildLiFiSwapGrantResult(executionRequest);
    case "grantLiFiApprovePermission":
      return buildLiFiApproveGrantResult(executionRequest);
    default: {
      const _exhaustive: never = grantKind;
      return _exhaustive;
    }
  }
}

export function usePermissionBatchAllValid(
  items: ReadonlyArray<{
    grantKind: GrantPermissionModalKind;
    request: IExecutionPermissionRequest;
  }>,
): boolean {
  const { liFiUtils } = useWallet();
  return items.every((item) =>
    isPermissionGrantItemValid(
      item.grantKind,
      item.request,
      liFiUtils.defaultSlippageBps,
    ),
  );
}
