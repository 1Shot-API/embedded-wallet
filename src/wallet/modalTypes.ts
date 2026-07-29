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
} from "@1shotapi/ows-types";
import type { IAddAssetApprovalRequest } from "./registerAddAsset";

export type WalletSetupChoice = "login" | "create" | "import" | "cancel";

/** Friendly host ERC-20 transfer consent (decoded transfer calldata). */
export interface IConfirmTransferRequest {
  domain: string;
  amount: string;
  tokenName: string;
  tokenSymbol: string;
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
  feeAtoms?: bigint;
};

/** Relayer confirm payload after UI validation. */
export type IRelayerConfirmSendResult = {
  paymentToken: EVMAccountAddress;
  feeAtoms: bigint;
};

/** Result from TX confirm when canceling or selecting payment (legacy shape). */
export type IConfirmSendResult = false | IConfirmSendPayment;

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
