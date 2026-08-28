import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BodyField, TextField } from "./configuratorFields";
import type { IWalletConfiguratorTextTabSectionProps } from "./walletConfiguratorTextTabTypes";

export function WalletConfiguratorTextTabWalletSections({
  form,
  patch,
}: IWalletConfiguratorTextTabSectionProps) {
  return (
    <>
      <AccordionItem value="balances">
        <AccordionTrigger>Balances / Receive</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="bal-tab-label"
            label="Tab label"
            value={form.balTabLabel}
            onChange={(value) => patch("balTabLabel", value)}
          />
          <TextField
            id="bal-refresh"
            label="Refresh"
            value={form.balRefresh}
            onChange={(value) => patch("balRefresh", value)}
          />
          <TextField
            id="receive-label"
            label="Receive button"
            value={form.receiveLabel}
            onChange={(value) => patch("receiveLabel", value)}
          />
          <TextField
            id="receive-title"
            label="Receive title"
            value={form.receiveTitle}
            onChange={(value) => patch("receiveTitle", value)}
          />
          <BodyField
            id="receive-body"
            label="Receive body ({chainLabel})"
            value={form.receiveBody}
            onChange={(value) => patch("receiveBody", value)}
          />
          <TextField
            id="receive-address-label"
            label="Address label"
            value={form.receiveAddressLabel}
            onChange={(value) => patch("receiveAddressLabel", value)}
          />
          <TextField
            id="receive-qr-alt"
            label="QR alt ({chainLabel})"
            value={form.receiveQrAlt}
            onChange={(value) => patch("receiveQrAlt", value)}
          />
          <TextField
            id="receive-copy"
            label="Copy"
            value={form.receiveCopyLabel}
            onChange={(value) => patch("receiveCopyLabel", value)}
          />
          <TextField
            id="receive-copied"
            label="Copied"
            value={form.receiveCopiedLabel}
            onChange={(value) => patch("receiveCopiedLabel", value)}
          />
          <TextField
            id="receive-copy-failed"
            label="Copy failed"
            value={form.receiveCopyFailedLabel}
            onChange={(value) => patch("receiveCopyFailedLabel", value)}
          />
          <TextField
            id="receive-close"
            label="Close"
            value={form.receiveCloseLabel}
            onChange={(value) => patch("receiveCloseLabel", value)}
          />
          <TextField
            id="send-label"
            label="Send button"
            value={form.sendLabel}
            onChange={(value) => patch("sendLabel", value)}
          />
          <TextField
            id="bridge-label"
            label="Bridge button"
            value={form.bridgeLabel}
            onChange={(value) => patch("bridgeLabel", value)}
          />
          <TextField
            id="cctp-bridge-title"
            label="Bridge modal title"
            value={form.cctpBridgeTitle}
            onChange={(value) => patch("cctpBridgeTitle", value)}
          />
          <BodyField
            id="cctp-bridge-body"
            label="Bridge modal body"
            value={form.cctpBridgeBody}
            onChange={(value) => patch("cctpBridgeBody", value)}
          />
          <TextField
            id="cctp-bridge-get-quote"
            label="Bridge get quote"
            value={form.cctpBridgeGetQuote}
            onChange={(value) => patch("cctpBridgeGetQuote", value)}
          />
          <TextField
            id="cctp-bridge-confirm"
            label="Bridge confirm"
            value={form.cctpBridgeConfirm}
            onChange={(value) => patch("cctpBridgeConfirm", value)}
          />
          <TextField
            id="cctp-bridge-cancel"
            label="Bridge cancel"
            value={form.cctpBridgeCancel}
            onChange={(value) => patch("cctpBridgeCancel", value)}
          />
          <TextField
            id="cctp-bridge-sent-title"
            label="Bridge success title"
            value={form.cctpBridgeSentTitle}
            onChange={(value) => patch("cctpBridgeSentTitle", value)}
          />
          <TextField
            id="confirm-transfer-title"
            label="Confirm transfer title"
            value={form.confirmTransferTitle}
            onChange={(value) => patch("confirmTransferTitle", value)}
          />
          <BodyField
            id="confirm-transfer-body"
            label="Confirm transfer body"
            value={form.confirmTransferBody}
            onChange={(value) => patch("confirmTransferBody", value)}
          />
          <TextField
            id="confirm-transfer-confirm"
            label="Confirm transfer confirm"
            value={form.confirmTransferConfirm}
            onChange={(value) => patch("confirmTransferConfirm", value)}
          />
          <TextField
            id="confirm-transfer-reject"
            label="Confirm transfer reject"
            value={form.confirmTransferReject}
            onChange={(value) => patch("confirmTransferReject", value)}
          />
          <TextField
            id="transfer-tokens-title"
            label="Transfer modal title"
            value={form.transferTokensTitle}
            onChange={(value) => patch("transferTokensTitle", value)}
          />
          <TextField
            id="transfer-tokens-send"
            label="Transfer send"
            value={form.transferTokensSend}
            onChange={(value) => patch("transferTokensSend", value)}
          />
          <TextField
            id="transfer-tokens-cancel"
            label="Transfer cancel"
            value={form.transferTokensCancel}
            onChange={(value) => patch("transferTokensCancel", value)}
          />
          <TextField
            id="grant-permission-title"
            label="Grant permission title"
            value={form.grantPermissionTitle}
            onChange={(value) => patch("grantPermissionTitle", value)}
          />
          <TextField
            id="grant-permission-grant"
            label="Grant permission confirm"
            value={form.grantPermissionGrant}
            onChange={(value) => patch("grantPermissionGrant", value)}
          />
          <TextField
            id="grant-permission-reject"
            label="Grant permission reject"
            value={form.grantPermissionReject}
            onChange={(value) => patch("grantPermissionReject", value)}
          />
          <TextField
            id="cancel-delegation-title"
            label="Cancel permission title"
            value={form.cancelDelegationTitle}
            onChange={(value) => patch("cancelDelegationTitle", value)}
          />
          <TextField
            id="cancel-delegation-confirm"
            label="Cancel permission confirm"
            value={form.cancelDelegationConfirm}
            onChange={(value) => patch("cancelDelegationConfirm", value)}
          />
          <TextField
            id="cancel-delegation-reject"
            label="Cancel permission keep"
            value={form.cancelDelegationReject}
            onChange={(value) => patch("cancelDelegationReject", value)}
          />
          <TextField
            id="transfer-tokens-sent-title"
            label="Transfer sent title"
            value={form.transferTokensSentTitle}
            onChange={(value) => patch("transferTokensSentTitle", value)}
          />
          <TextField
            id="transfer-tokens-view-explorer"
            label="Transfer view on explorer"
            value={form.transferTokensViewExplorer}
            onChange={(value) => patch("transferTokensViewExplorer", value)}
          />
          <TextField
            id="transfer-tokens-done"
            label="Transfer done"
            value={form.transferTokensDone}
            onChange={(value) => patch("transferTokensDone", value)}
          />
          <TextField
            id="passkey-prompt-unlock-title"
            label="Passkey unlock title"
            value={form.passkeyPromptUnlockTitle}
            onChange={(value) => patch("passkeyPromptUnlockTitle", value)}
          />
          <TextField
            id="passkey-prompt-create-title"
            label="Passkey create title"
            value={form.passkeyPromptCreateTitle}
            onChange={(value) => patch("passkeyPromptCreateTitle", value)}
          />
          <TextField
            id="passkey-prompt-sign-title"
            label="Passkey sign title"
            value={form.passkeyPromptSignTitle}
            onChange={(value) => patch("passkeyPromptSignTitle", value)}
          />
          <TextField
            id="passkey-prompt-encrypt-title"
            label="Passkey encrypt title"
            value={form.passkeyPromptEncryptTitle}
            onChange={(value) => patch("passkeyPromptEncryptTitle", value)}
          />
          <TextField
            id="passkey-prompt-decrypt-title"
            label="Passkey decrypt title"
            value={form.passkeyPromptDecryptTitle}
            onChange={(value) => patch("passkeyPromptDecryptTitle", value)}
          />
          <TextField
            id="passkey-prompt-relayer-title"
            label="Passkey relayer auth title"
            value={form.passkeyPromptRelayerTitle}
            onChange={(value) => patch("passkeyPromptRelayerTitle", value)}
          />
          <TextField
            id="passkey-prompt-backup-title"
            label="Passkey backup title"
            value={form.passkeyPromptBackupTitle}
            onChange={(value) => patch("passkeyPromptBackupTitle", value)}
          />
          <TextField
            id="passkey-prompt-export-title"
            label="Passkey export key title"
            value={form.passkeyPromptExportPrivateKeyTitle}
            onChange={(value) =>
              patch("passkeyPromptExportPrivateKeyTitle", value)
            }
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="exportPrivateKey">
        <AccordionTrigger>Export private key</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="export-key-title"
            label="Title"
            value={form.exportPrivateKeyTitle}
            onChange={(value) => patch("exportPrivateKeyTitle", value)}
          />
          <BodyField
            id="export-key-body"
            label="Body"
            value={form.exportPrivateKeyBody}
            onChange={(value) => patch("exportPrivateKeyBody", value)}
          />
          <TextField
            id="export-key-continue"
            label="Continue"
            value={form.exportPrivateKeyContinue}
            onChange={(value) => patch("exportPrivateKeyContinue", value)}
          />
          <TextField
            id="export-key-cancel"
            label="Cancel"
            value={form.exportPrivateKeyCancel}
            onChange={(value) => patch("exportPrivateKeyCancel", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="importPrivateKey">
        <AccordionTrigger>Import private key</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="import-key-title"
            label="Title"
            value={form.importPrivateKeyTitle}
            onChange={(value) => patch("importPrivateKeyTitle", value)}
          />
          <BodyField
            id="import-key-body"
            label="Body"
            value={form.importPrivateKeyBody}
            onChange={(value) => patch("importPrivateKeyBody", value)}
          />
          <TextField
            id="import-key-continue"
            label="Continue"
            value={form.importPrivateKeyContinue}
            onChange={(value) => patch("importPrivateKeyContinue", value)}
          />
          <TextField
            id="import-key-cancel"
            label="Cancel"
            value={form.importPrivateKeyCancel}
            onChange={(value) => patch("importPrivateKeyCancel", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="advancedOptions">
        <AccordionTrigger>Advanced options</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="advanced-title"
            label="Title"
            value={form.advancedOptionsTitle}
            onChange={(value) => patch("advancedOptionsTitle", value)}
          />
          <TextField
            id="advanced-menu-label"
            label="Menu label"
            value={form.advancedOptionsMenuLabel}
            onChange={(value) => patch("advancedOptionsMenuLabel", value)}
          />
          <BodyField
            id="advanced-body"
            label="Body"
            value={form.advancedOptionsBody}
            onChange={(value) => patch("advancedOptionsBody", value)}
          />
          <TextField
            id="advanced-change-account"
            label="Change account"
            value={form.advancedOptionsChangeAccountLabel}
            onChange={(value) =>
              patch("advancedOptionsChangeAccountLabel", value)
            }
          />
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
