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
import { AppendedCaveatTerms } from "./appendedCaveatTerms";
import {
  buildErc20PeriodicGrantResult,
  Erc20PeriodicPermissionTerms,
  isErc20PeriodicPermissionValid,
} from "./erc20PeriodicTerms";
import {
  buildErc20StreamingGrantResult,
  Erc20StreamingPermissionTerms,
  isErc20StreamingPermissionValid,
} from "./erc20StreamingTerms";
import {
  buildErc20TransferGrantResult,
  Erc20TransferPermissionTerms,
  isErc20TransferPermissionValid,
} from "./erc20TransferTerms";
import {
  buildErc721TransferGrantResult,
  Erc721TransferPermissionTerms,
  isErc721TransferPermissionValid,
} from "./erc721TransferTerms";
import {
  buildFunctionCallGrantResult,
  FunctionCallPermissionTerms,
  isFunctionCallPermissionValid,
} from "./functionCallTerms";
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
import {
  buildNativePeriodTransferGrantResult,
  isNativePeriodTransferPermissionValid,
  NativePeriodTransferPermissionTerms,
} from "./nativePeriodTransferTerms";
import {
  buildNativeStreamingGrantResult,
  isNativeStreamingPermissionValid,
  NativeStreamingPermissionTerms,
} from "./nativeStreamingTerms";
import {
  buildNativeTransferGrantResult,
  isNativeTransferPermissionValid,
  NativeTransferPermissionTerms,
} from "./nativeTransferTerms";
import {
  buildOwnershipTransferGrantResult,
  isOwnershipTransferPermissionValid,
  OwnershipTransferPermissionTerms,
} from "./ownershipTransferTerms";

function renderScopeTerms(
  grantKind: GrantPermissionModalKind,
  executionRequest: IExecutionPermissionRequest,
) {
  switch (grantKind) {
    case "grantExecutionPermission":
      return (
        <Erc20PeriodicPermissionTerms executionRequest={executionRequest} />
      );
    case "grantErc20TransferPermission":
      return (
        <Erc20TransferPermissionTerms executionRequest={executionRequest} />
      );
    case "grantErc20StreamingPermission":
      return (
        <Erc20StreamingPermissionTerms executionRequest={executionRequest} />
      );
    case "grantNativeTransferPermission":
      return (
        <NativeTransferPermissionTerms executionRequest={executionRequest} />
      );
    case "grantNativeStreamingPermission":
      return (
        <NativeStreamingPermissionTerms executionRequest={executionRequest} />
      );
    case "grantNativePeriodTransferPermission":
      return (
        <NativePeriodTransferPermissionTerms
          executionRequest={executionRequest}
        />
      );
    case "grantErc721TransferPermission":
      return (
        <Erc721TransferPermissionTerms executionRequest={executionRequest} />
      );
    case "grantOwnershipTransferPermission":
      return (
        <OwnershipTransferPermissionTerms
          executionRequest={executionRequest}
        />
      );
    case "grantFunctionCallPermission":
      return (
        <FunctionCallPermissionTerms executionRequest={executionRequest} />
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

export function PermissionGrantTermsSection({
  grantKind,
  executionRequest,
}: {
  grantKind: GrantPermissionModalKind;
  executionRequest: IExecutionPermissionRequest;
}) {
  const scopeTerms = renderScopeTerms(grantKind, executionRequest);
  const appendedCaveats = executionRequest.caveats ?? [];
  return (
    <>
      {scopeTerms}
      {appendedCaveats.map((caveat, index) => (
        <AppendedCaveatTerms
          key={`${caveat.type}:${index}:${JSON.stringify(caveat.data)}`}
          caveat={caveat}
        />
      ))}
    </>
  );
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
    case "grantErc20TransferPermission":
      return isErc20TransferPermissionValid(executionRequest);
    case "grantErc20StreamingPermission":
      return isErc20StreamingPermissionValid(executionRequest);
    case "grantNativeTransferPermission":
      return isNativeTransferPermissionValid(executionRequest);
    case "grantNativeStreamingPermission":
      return isNativeStreamingPermissionValid(executionRequest);
    case "grantNativePeriodTransferPermission":
      return isNativePeriodTransferPermissionValid(executionRequest);
    case "grantErc721TransferPermission":
      return isErc721TransferPermissionValid(executionRequest);
    case "grantOwnershipTransferPermission":
      return isOwnershipTransferPermissionValid(executionRequest);
    case "grantFunctionCallPermission":
      return isFunctionCallPermissionValid(executionRequest);
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
    case "grantErc20TransferPermission":
      return buildErc20TransferGrantResult(executionRequest);
    case "grantErc20StreamingPermission":
      return buildErc20StreamingGrantResult(executionRequest);
    case "grantNativeTransferPermission":
      return buildNativeTransferGrantResult(executionRequest);
    case "grantNativeStreamingPermission":
      return buildNativeStreamingGrantResult(executionRequest);
    case "grantNativePeriodTransferPermission":
      return buildNativePeriodTransferGrantResult(executionRequest);
    case "grantErc721TransferPermission":
      return buildErc721TransferGrantResult(executionRequest);
    case "grantOwnershipTransferPermission":
      return buildOwnershipTransferGrantResult(executionRequest);
    case "grantFunctionCallPermission":
      return buildFunctionCallGrantResult(executionRequest);
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
