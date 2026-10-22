import { useModalStore } from "../wallet/modalStore";

import { ActivateOfflinePermissionsModal } from "./modals/ActivateOfflinePermissionsModal";
import { AddAssetModal } from "./modals/AddAssetModal";
import { AdvancedOptionsModal } from "./modals/AdvancedOptionsModal";
import { CancelDelegationModal } from "./modals/CancelDelegationModal";
import { CCTPBridge } from "./modals/CCTPBridge";
import {
  CredentialOfferModal,
  CredentialPresentationModal,
} from "./modals/CredentialModals";
import { ExportPrivateKeyModal } from "./modals/ExportPrivateKeyModal";
import { GrantPermissionConsentModal } from "./modals/GrantPermissionConsentModal";
import { ImportPrivateKeyModal } from "./modals/ImportPrivateKeyModal";
import { OpenCreateTabModal } from "./modals/OpenCreateTabModal";
import { ConnectModal } from "./modals/ConnectModal";
import { EVMConfirmTransferModal } from "./modals/EVMConfirmTransferModal";
import { EVMSendTransactionModal } from "./modals/EVMSendTransactionModal";
import { EVMSignModal } from "./modals/EVMSignModal";
import { EVMSiweModal } from "./modals/EVMSiweModal";
import { EVMTypedDataModal } from "./modals/EVMTypedDataModal";
import { PasskeyNameModal } from "./modals/PasskeyNameModal";
import { SolanaSignAndSendModal } from "./modals/SolanaSignAndSendModal";
import { SolanaSignModal } from "./modals/SolanaSignModal";
import { SolanaSiwsModal } from "./modals/SolanaSiwsModal";
import { WalletSetupModal } from "./modals/WalletSetupModal";
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
        <EVMSignModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "solanaSign":
      return (
        <SolanaSignModal
          address={activeModal.address}
          messages={activeModal.messages}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "typedData":
      return (
        <EVMTypedDataModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "siwe":
      return (
        <EVMSiweModal
          source={activeModal.source}
          request={activeModal.request}
          fields={activeModal.fields}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "siws":
      return (
        <SolanaSiwsModal
          fields={activeModal.fields}
          messageBytes={activeModal.messageBytes}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "solanaSignAndSend":
      return (
        <SolanaSignAndSendModal
          mode={activeModal.mode}
          chainId={activeModal.chainId}
          address={activeModal.address}
          summaries={activeModal.summaries}
          messageBytesList={activeModal.messageBytesList}
          warnings={activeModal.warnings}
          submit={activeModal.submit}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "sendTransaction":
      return (
        <EVMSendTransactionModal
          request={activeModal.request}
          execute={activeModal.execute}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "confirmTransfer":
      return (
        <EVMConfirmTransferModal
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
    case "grantExecutionPermissions":
      return (
        <GrantPermissionConsentModal
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "activateOfflinePermissions":
      return (
        <ActivateOfflinePermissionsModal
          request={activeModal.request}
          execute={activeModal.execute}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    case "cancelDelegation":
      return (
        <CancelDelegationModal
          request={activeModal.request}
          execute={activeModal.execute}
          executeLocal={activeModal.executeLocal}
          onRegisterAwaitingConfirmation={
            activeModal.onRegisterAwaitingConfirmation
          }
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
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
          tokenAddress={activeModal.request.tokenAddress}
          iconUrl={activeModal.request.iconUrl}
          onClose={() => activeModal.resolve()}
        />
      );
    case "cctpBridge":
      return (
        <CCTPBridge
          request={activeModal.request}
          onResolve={activeModal.resolve}
          onReject={activeModal.reject}
        />
      );
    default:
      return null;
  }
}
