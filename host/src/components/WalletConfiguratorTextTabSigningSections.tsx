import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BodyField, TextField } from "./configuratorFields";
import type { IWalletConfiguratorTextTabSectionProps } from "./walletConfiguratorTextTabTypes";

export function WalletConfiguratorTextTabSigningSections({
  form,
  patch,
}: IWalletConfiguratorTextTabSectionProps) {
  return (
    <>
      <AccordionItem value="connect">
        <AccordionTrigger>Connect</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="connect-title"
            label="Title"
            value={form.connectTitle}
            onChange={(value) => patch("connectTitle", value)}
          />
          <BodyField
            id="connect-body"
            label="Body"
            value={form.connectBody}
            onChange={(value) => patch("connectBody", value)}
          />
          <TextField
            id="connect-continue"
            label="Continue"
            value={form.connectContinue}
            onChange={(value) => patch("connectContinue", value)}
          />
          <TextField
            id="connect-reject"
            label="Reject"
            value={form.connectReject}
            onChange={(value) => patch("connectReject", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="setup">
        <AccordionTrigger>Wallet setup</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="setup-title"
            label="Title"
            value={form.setupTitle}
            onChange={(value) => patch("setupTitle", value)}
          />
          <BodyField
            id="setup-body"
            label="Body"
            value={form.setupBody}
            onChange={(value) => patch("setupBody", value)}
          />
          <TextField
            id="setup-create"
            label="Create"
            value={form.setupCreate}
            onChange={(value) => patch("setupCreate", value)}
          />
          <TextField
            id="setup-login"
            label="Login"
            value={form.setupLogin}
            onChange={(value) => patch("setupLogin", value)}
          />
          <TextField
            id="setup-cancel"
            label="Cancel"
            value={form.setupCancel}
            onChange={(value) => patch("setupCancel", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="account">
        <AccordionTrigger>Account shell</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="select-network-title"
            label="Select network title"
            value={form.selectNetworkTitle}
            onChange={(value) => patch("selectNetworkTitle", value)}
          />
          <TextField
            id="select-network-cancel"
            label="Select network cancel"
            value={form.selectNetworkCancelLabel}
            onChange={(value) => patch("selectNetworkCancelLabel", value)}
          />
          <TextField
            id="copy-address-label"
            label="Copy address"
            value={form.copyAddressLabel}
            onChange={(value) => patch("copyAddressLabel", value)}
          />
          <TextField
            id="address-copied-label"
            label="Address copied"
            value={form.addressCopiedLabel}
            onChange={(value) => patch("addressCopiedLabel", value)}
          />
          <TextField
            id="address-copy-failed-label"
            label="Address copy failed"
            value={form.addressCopyFailedLabel}
            onChange={(value) => patch("addressCopyFailedLabel", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="passkey">
        <AccordionTrigger>Passkey name</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="passkey-title"
            label="Title"
            value={form.passkeyTitle}
            onChange={(value) => patch("passkeyTitle", value)}
          />
          <BodyField
            id="passkey-body"
            label="Body"
            value={form.passkeyBody}
            onChange={(value) => patch("passkeyBody", value)}
          />
          <TextField
            id="passkey-continue"
            label="Continue"
            value={form.passkeyContinue}
            onChange={(value) => patch("passkeyContinue", value)}
          />
          <TextField
            id="passkey-cancel"
            label="Cancel"
            value={form.passkeyCancel}
            onChange={(value) => patch("passkeyCancel", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="sign">
        <AccordionTrigger>Personal sign</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="sign-title"
            label="Title"
            value={form.signTitle}
            onChange={(value) => patch("signTitle", value)}
          />
          <TextField
            id="sign-label"
            label="Sign"
            value={form.signLabel}
            onChange={(value) => patch("signLabel", value)}
          />
          <TextField
            id="sign-reject"
            label="Reject"
            value={form.signReject}
            onChange={(value) => patch("signReject", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="typed">
        <AccordionTrigger>Typed data</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="typed-title"
            label="Title"
            value={form.typedTitle}
            onChange={(value) => patch("typedTitle", value)}
          />
          <TextField
            id="typed-sign"
            label="Sign"
            value={form.typedSignLabel}
            onChange={(value) => patch("typedSignLabel", value)}
          />
          <TextField
            id="typed-reject"
            label="Reject"
            value={form.typedReject}
            onChange={(value) => patch("typedReject", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="send-tx">
        <AccordionTrigger>Send transaction</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="tx-title"
            label="Title"
            value={form.txTitle}
            onChange={(value) => patch("txTitle", value)}
          />
          <TextField
            id="tx-sign"
            label="Sign"
            value={form.txSignLabel}
            onChange={(value) => patch("txSignLabel", value)}
          />
          <TextField
            id="tx-reject"
            label="Reject"
            value={form.txReject}
            onChange={(value) => patch("txReject", value)}
          />
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
