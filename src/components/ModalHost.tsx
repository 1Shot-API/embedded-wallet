import { useModalStore } from "../wallet/modalStore";
import {
  ConnectModal,
  PasskeyNameModal,
  WalletSetupModal,
} from "./modals/SetupModals";
import {
  PersonalSignModal,
  SendTransactionModal,
  ConfirmTransferModal,
  TypedDataModal,
} from "./modals/SignModals";
import {
  CredentialOfferModal,
  CredentialPresentationModal,
} from "./modals/CredentialModals";
import { ExportPrivateKeyModal } from "./modals/ExportPrivateKeyModal";
import { ImportPrivateKeyModal } from "./modals/ImportPrivateKeyModal";
import { AdvancedOptionsModal } from "./modals/AdvancedOptionsModal";
import { AddAssetModal } from "./modals/AddAssetModal";
import { OpenCreateTabModal } from "./modals/OpenCreateTabModal";
import { OnrampView } from "./OnrampView";

export function ModalHost() {
  const activeModal = useModalStore((state) => state.activeModal);
  if (!activeModal) return null;

  switch (activeModal.kind) {
    case "walletSetup":
      return <WalletSetupModal onResolve={activeModal.resolve} />;
    case "passkeyName":
      return <PasskeyNameModal onResolve={activeModal.resolve} />;
    case "connect":
      return <ConnectModal onResolve={activeModal.resolve} />;
    case "personalSign":
      return (
        <PersonalSignModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "typedData":
      return (
        <TypedDataModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "sendTransaction":
      return (
        <SendTransactionModal
          request={activeModal.request}
          execute={activeModal.execute}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "confirmTransfer":
      return (
        <ConfirmTransferModal
          request={activeModal.request}
          execute={activeModal.execute}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "credentialOffer":
      return (
        <CredentialOfferModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "credentialPresentation":
      return (
        <CredentialPresentationModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "addAsset":
      return (
        <AddAssetModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
        />
      );
    case "exportPrivateKey":
      return (
        <ExportPrivateKeyModal
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "importPrivateKey":
      return (
        <ImportPrivateKeyModal
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "advancedOptions":
      return (
        <AdvancedOptionsModal
          allowExport={activeModal.allowExport}
          onResolve={activeModal.resolve}
        />
      );
    case "openCreateTab":
      return (
        <OpenCreateTabModal
          createUrl={activeModal.createUrl}
          onResolve={activeModal.resolve}
        />
      );
    case "onramp":
      return (
        <OnrampView
          destinationAddress={activeModal.request.destinationAddress}
          chainId={activeModal.request.chainId}
          amount={activeModal.request.amount}
          tokenSymbol={activeModal.request.tokenSymbol}
          onClose={() => activeModal.resolve()}
        />
      );
    default:
      return null;
  }
}
