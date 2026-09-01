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

/** Host EIP-7715 grant consent — attenuated permission + memo for vault. */
export interface IGrantExecutionPermissionRequest {
  request: IExecutionPermissionRequest;
  domain: string;
  chainName: string;
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
      execute: (payment: IConfirmSendPayment) => Promise<EVMTransactionHash>;
      resolve: (hash: EVMTransactionHash) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "confirmTransfer";
      request: IConfirmTransferRequest;
      execute: (payment: IConfirmSendPayment) => Promise<EVMTransactionHash>;
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
      kind: "grantExecutionPermission";
      request: IGrantExecutionPermissionRequest;
      resolve: (result: IGrantExecutionPermissionResult) => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "cancelDelegation";
      request: ICancelDelegationConfirmRequest;
      execute: (
        payment: IRelayerConfirmSendResult,
      ) => Promise<EVMTransactionHash>;
      onRegisterAwaitingConfirmation?: (notify: () => void) => void;
      resolve: (hash: EVMTransactionHash) => void;
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
