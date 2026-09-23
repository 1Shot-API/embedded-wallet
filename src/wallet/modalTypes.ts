import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
  EVMAccountAddress,
  EVMChainId,
  EVMSignatureHex,
  EVMTransactionHash,
  IExecutionPermission,
  IExecutionPermissionRequest,
} from "@1shotapi/ows-types";
import type { ISiweFields } from "../lib/types/domain/SiweFields";
import type { IAddAssetApprovalRequest } from "./registerAddAsset";
import type { IOnrampOpenRequest } from "../circle/onrampTypes";
import type {
  ICctpBridgeModalResult,
  ICctpBridgeOpenRequest,
} from "../circle/cctpBridgeTypes";
import type { TokenAmount } from "../lib/types/primitives";
import type { IRelayerSendUiCallbacks } from "../lib/types/domain/RelayerSendUi";
import type { ITransactionWork } from "../lib/interfaces/business/ITransactionService";
import type { IActivationPayment } from "../lib/interfaces/business/utils/ITransactionUtils";

export type WalletSetupChoice = "login" | "create" | "import" | "cancel";

/** Friendly host ERC-20 transfer consent (decoded transfer calldata). */
export interface IConfirmTransferRequest {
  domain: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: EVMAccountAddress;
  receiver: string;
  chainName: string;
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  useRelayer: boolean;
  /** ExactCalldata work for unsigned fee estimate (host send payload). */
  work: ITransactionWork;
}

/** Relayer payment selection from TX confirm UI (before execute). */
export type IConfirmSendPayment = {
  /** Required when the confirm modal was opened with `useRelayer: true`. */
  paymentToken?: EVMAccountAddress;
  feeAtoms?: TokenAmount;
};

/** Relayer confirm payload after UI validation. */
export type IRelayerConfirmSendResult = {
  paymentToken: EVMAccountAddress;
  feeAtoms: TokenAmount;
};

/** Result from TX confirm when canceling or selecting payment (legacy shape). */
export type IConfirmSendResult = false | IConfirmSendPayment;

export type GrantPermissionModalKind =
  | "grantExecutionPermission"
  | "grantLiFiSwapPermission"
  | "grantLiFiApprovePermission";

/** One permission in a grant consent batch. */
export interface IGrantExecutionPermissionsBatchItem {
  request: IExecutionPermissionRequest;
  chainName: string;
  grantKind: GrantPermissionModalKind;
}

/** Host EIP-7715 grant consent — single or compound permission requests. */
export interface IGrantExecutionPermissionsBatchRequest {
  domain: string;
  items: IGrantExecutionPermissionsBatchItem[];
}

export type IGrantExecutionPermissionResult = {
  permission: IExecutionPermission;
  memo: string;
};

/** Cancel / revoke confirm (on-chain disableDelegation). */
export interface ICancelDelegationConfirmRequest {
  domain: string;
  chainName: string;
  chainId: EVMChainId;
  ownerAddress: EVMAccountAddress;
  /** ExactCalldata work for unsigned fee estimate. */
  work: ITransactionWork;
  /**
   * When true, the modal offers “Skip onchain cancellation” (vault delete
   * only). Requires a stored vault row.
   */
  allowSkipOnchain: boolean;
}

/** One-time EIP-7702 activation before an EIP-7715 grant. */
export interface IActivateOfflinePermissionsRequest {
  domain: string;
  ownerAddress: EVMAccountAddress;
  /** Chains that still need EIP-7702 upgrade for this grant request. */
  upgradeChains: Array<{ chainId: EVMChainId; chainName: string }>;
  payment: IActivationPayment;
}

export type ModalRequest =
  | {
      id: string;
      kind: "walletSetup";
      resolve: (choice: WalletSetupChoice) => void;
    }
  | {
      id: string;
      kind: "passkeyName";
      resolve: (name: string | null) => void;
    }
  | {
      id: string;
      kind: "connect";
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "personalSign";
      request: PersonalSignApprovalRequest;
      resolve: (signature: EVMSignatureHex) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "typedData";
      request: SignTypedDataApprovalRequest;
      resolve: (signature: EVMSignatureHex) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "siwe";
      source: "typedData" | "personalSign";
      request: SignTypedDataApprovalRequest | PersonalSignApprovalRequest;
      fields: ISiweFields;
      resolve: (signature: EVMSignatureHex) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "sendTransaction";
      request: SendTransactionApprovalRequest & { useRelayer?: boolean };
      execute: (
        payment: IConfirmSendPayment,
        ui?: IRelayerSendUiCallbacks,
      ) => Promise<EVMTransactionHash>;
      resolve: (hash: EVMTransactionHash) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "confirmTransfer";
      request: IConfirmTransferRequest;
      execute: (
        payment: IConfirmSendPayment,
        ui?: IRelayerSendUiCallbacks,
      ) => Promise<EVMTransactionHash>;
      resolve: (hash: EVMTransactionHash) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "credentialOffer";
      request: CredentialOfferApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "credentialPresentation";
      request: CredentialPresentationApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "addAsset";
      request: IAddAssetApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "grantExecutionPermissions";
      request: IGrantExecutionPermissionsBatchRequest;
      resolve: (results: IGrantExecutionPermissionResult[]) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "activateOfflinePermissions";
      request: IActivateOfflinePermissionsRequest;
      execute: (
        payment: IRelayerConfirmSendResult,
        ui: IRelayerSendUiCallbacks,
      ) => Promise<EVMTransactionHash>;
      resolve: (hash: EVMTransactionHash) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "cancelDelegation";
      request: ICancelDelegationConfirmRequest;
      execute: (
        payment: IRelayerConfirmSendResult,
        ui: IRelayerSendUiCallbacks,
      ) => Promise<EVMTransactionHash>;
      /** Vault-only delete when the user skips on-chain cancel. */
      executeLocal: () => Promise<void>;
      onRegisterAwaitingConfirmation?: (notify: () => void) => void;
      resolve: (hash: EVMTransactionHash | null) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "exportPrivateKey";
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "importPrivateKey";
      resolve: (imported: boolean) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "advancedOptions";
      allowExport: boolean;
      resolve: (choice: AdvancedOptionsChoice) => void;
    }
  | {
      id: string;
      kind: "openCreateTab";
      createUrl: string;
      /** true when user confirms open; false when cancelled. */
      resolve: (opened: boolean) => void;
    }
  | {
      id: string;
      kind: "onramp";
      request: IOnrampOpenRequest;
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "cctpBridge";
      request: ICctpBridgeOpenRequest;
      resolve: (result: ICctpBridgeModalResult) => void;
      reject: (error: unknown) => void;
    };

export type ActiveModal = ModalRequest;

export type AdvancedOptionsChoice =
  | "export"
  | "import"
  | "changeAccount"
  | "close";

let modalId = 0;

export function nextModalId(): string {
  modalId += 1;
  return `modal-${modalId}`;
}
