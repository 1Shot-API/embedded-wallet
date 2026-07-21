import type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type {
  CredentialOfferApprovalRequest,
  CredentialPresentationApprovalRequest,
  RecoveryDataCreatedData,
} from "@1shotapi/ows-types";
import type { IAddAssetApprovalRequest } from "./registerAddAsset";

export type WalletSetupChoice = "login" | "create" | "cancel";

/** Friendly host ERC-20 transfer consent (decoded transfer calldata). */
export interface IConfirmTransferRequest {
  domain: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
  receiver: string;
  chainName: string;
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
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "typedData";
      request: SignTypedDataApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "sendTransaction";
      request: SendTransactionApprovalRequest;
      resolve: (approved: boolean) => void;
    }
  | {
      id: string;
      kind: "confirmTransfer";
      request: IConfirmTransferRequest;
      resolve: (approved: boolean) => void;
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
      kind: "createBackup";
      resolve: () => void;
      reject: (error: unknown) => void;
    }
  | {
      id: string;
      kind: "restoreBackup";
      encryptedPrivateKey: string;
      resolve: (restored: boolean) => void;
      reject: (error: unknown) => void;
    };

export type ActiveModal = ModalRequest;

let modalId = 0;

export function nextModalId(): string {
  modalId += 1;
  return `modal-${modalId}`;
}

export type CreateBackupResult = RecoveryDataCreatedData;
