import { BodyField, TextField } from "./configuratorFields";
import type { IWalletConfiguratorTextTabSectionProps } from "./walletConfiguratorTextTabTypes";

import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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
          <TextField
            id="setup-passkey-timeout"
            label="Passkey timeout error"
            value={form.setupPasskeyTimeoutError}
            onChange={(value) => patch("setupPasskeyTimeoutError", value)}
          />
          <TextField
            id="setup-passkey-failed"
            label="Passkey failed error"
            value={form.setupPasskeyFailedError}
            onChange={(value) => patch("setupPasskeyFailedError", value)}
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
          <TextField
            id="passkey-terms-prefix"
            label="Terms acceptance prefix"
            value={form.passkeyTermsPrefix}
            onChange={(value) => patch("passkeyTermsPrefix", value)}
          />
          <TextField
            id="passkey-terms-of-service"
            label="Terms of Service label"
            value={form.passkeyTermsOfServiceLabel}
            onChange={(value) => patch("passkeyTermsOfServiceLabel", value)}
          />
          <TextField
            id="passkey-terms-joiner"
            label="Terms acceptance joiner"
            value={form.passkeyTermsJoiner}
            onChange={(value) => patch("passkeyTermsJoiner", value)}
          />
          <TextField
            id="passkey-privacy-label"
            label="Privacy Policy label"
            value={form.passkeyPrivacyLabel}
            onChange={(value) => patch("passkeyPrivacyLabel", value)}
          />
          <TextField
            id="passkey-terms-error"
            label="Terms acceptance error"
            value={form.passkeyTermsError}
            onChange={(value) => patch("passkeyTermsError", value)}
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
          <BodyField
            id="sign-body"
            label="Body"
            value={form.signBody}
            onChange={(value) => patch("signBody", value)}
          />
          <TextField
            id="sign-network"
            label="Network label"
            value={form.signNetworkLabel}
            onChange={(value) => patch("signNetworkLabel", value)}
          />
          <TextField
            id="sign-account"
            label="Account label"
            value={form.signAccountLabel}
            onChange={(value) => patch("signAccountLabel", value)}
          />
          <TextField
            id="sign-message"
            label="Message label"
            value={form.signMessageLabel}
            onChange={(value) => patch("signMessageLabel", value)}
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
          <TextField
            id="sign-hint"
            label="Signing hint"
            value={form.signSigningHint}
            onChange={(value) => patch("signSigningHint", value)}
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
          <BodyField
            id="typed-body"
            label="Body"
            value={form.typedBody}
            onChange={(value) => patch("typedBody", value)}
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
          <TextField
            id="typed-signing-hint"
            label="Signing hint"
            value={form.typedSigningHint}
            onChange={(value) => patch("typedSigningHint", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="siwe">
        <AccordionTrigger>Sign-in (SIWE)</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="siwe-title"
            label="Title"
            value={form.siweTitle}
            onChange={(value) => patch("siweTitle", value)}
          />
          <BodyField
            id="siwe-body"
            label="Body ({domain})"
            value={form.siweBody}
            onChange={(value) => patch("siweBody", value)}
          />
          <TextField
            id="siwe-network"
            label="Network label"
            value={form.siweNetworkLabel}
            onChange={(value) => patch("siweNetworkLabel", value)}
          />
          <TextField
            id="siwe-signing-in-with"
            label="Signing in with label"
            value={form.siweSigningInWithLabel}
            onChange={(value) => patch("siweSigningInWithLabel", value)}
          />
          <TextField
            id="siwe-message"
            label="Message label"
            value={form.siweMessageLabel}
            onChange={(value) => patch("siweMessageLabel", value)}
          />
          <TextField
            id="siwe-uri"
            label="URI label"
            value={form.siweUriLabel}
            onChange={(value) => patch("siweUriLabel", value)}
          />
          <TextField
            id="siwe-version"
            label="Version label"
            value={form.siweVersionLabel}
            onChange={(value) => patch("siweVersionLabel", value)}
          />
          <TextField
            id="siwe-nonce"
            label="Nonce label"
            value={form.siweNonceLabel}
            onChange={(value) => patch("siweNonceLabel", value)}
          />
          <TextField
            id="siwe-issued-at"
            label="Issued at label"
            value={form.siweIssuedAtLabel}
            onChange={(value) => patch("siweIssuedAtLabel", value)}
          />
          <TextField
            id="siwe-expiration"
            label="Expiration time label"
            value={form.siweExpirationTimeLabel}
            onChange={(value) => patch("siweExpirationTimeLabel", value)}
          />
          <TextField
            id="siwe-not-before"
            label="Not before label"
            value={form.siweNotBeforeLabel}
            onChange={(value) => patch("siweNotBeforeLabel", value)}
          />
          <TextField
            id="siwe-resources"
            label="Resources label"
            value={form.siweResourcesLabel}
            onChange={(value) => patch("siweResourcesLabel", value)}
          />
          <TextField
            id="siwe-reject"
            label="Reject"
            value={form.siweRejectLabel}
            onChange={(value) => patch("siweRejectLabel", value)}
          />
          <TextField
            id="siwe-sign"
            label="Sign in"
            value={form.siweSignLabel}
            onChange={(value) => patch("siweSignLabel", value)}
          />
          <TextField
            id="siwe-signing-hint"
            label="Signing hint"
            value={form.siweSigningHint}
            onChange={(value) => patch("siweSigningHint", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="solana-sign">
        <AccordionTrigger>Solana sign message</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="solana-sign-title"
            label="Title"
            value={form.solanaSignTitle}
            onChange={(value) => patch("solanaSignTitle", value)}
          />
          <BodyField
            id="solana-sign-body"
            label="Body"
            value={form.solanaSignBody}
            onChange={(value) => patch("solanaSignBody", value)}
          />
          <TextField
            id="solana-sign-network"
            label="Network label"
            value={form.solanaSignNetworkLabel}
            onChange={(value) => patch("solanaSignNetworkLabel", value)}
          />
          <TextField
            id="solana-sign-account"
            label="Account label"
            value={form.solanaSignAccountLabel}
            onChange={(value) => patch("solanaSignAccountLabel", value)}
          />
          <TextField
            id="solana-sign-message"
            label="Message label"
            value={form.solanaSignMessageLabel}
            onChange={(value) => patch("solanaSignMessageLabel", value)}
          />
          <TextField
            id="solana-sign-label"
            label="Sign"
            value={form.solanaSignLabel}
            onChange={(value) => patch("solanaSignLabel", value)}
          />
          <TextField
            id="solana-sign-reject"
            label="Reject"
            value={form.solanaSignReject}
            onChange={(value) => patch("solanaSignReject", value)}
          />
          <TextField
            id="solana-sign-hint"
            label="Signing hint"
            value={form.solanaSignSigningHint}
            onChange={(value) => patch("solanaSignSigningHint", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="solana-tx">
        <AccordionTrigger>Solana transaction</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="solana-tx-title-sign"
            label="Sign title"
            value={form.solanaTxTitleSign}
            onChange={(value) => patch("solanaTxTitleSign", value)}
          />
          <TextField
            id="solana-tx-title-send"
            label="Sign & send title"
            value={form.solanaTxTitleSignAndSend}
            onChange={(value) => patch("solanaTxTitleSignAndSend", value)}
          />
          <BodyField
            id="solana-tx-body-sign"
            label="Sign body"
            value={form.solanaTxBodySign}
            onChange={(value) => patch("solanaTxBodySign", value)}
          />
          <BodyField
            id="solana-tx-body-send"
            label="Sign & send body"
            value={form.solanaTxBodySignAndSend}
            onChange={(value) => patch("solanaTxBodySignAndSend", value)}
          />
          <TextField
            id="solana-tx-network"
            label="Network label"
            value={form.solanaTxNetworkLabel}
            onChange={(value) => patch("solanaTxNetworkLabel", value)}
          />
          <TextField
            id="solana-tx-account"
            label="Account label"
            value={form.solanaTxAccountLabel}
            onChange={(value) => patch("solanaTxAccountLabel", value)}
          />
          <TextField
            id="solana-tx-fee-payer"
            label="Fee payer label"
            value={form.solanaTxFeePayerLabel}
            onChange={(value) => patch("solanaTxFeePayerLabel", value)}
          />
          <TextField
            id="solana-tx-instructions"
            label="Instructions label"
            value={form.solanaTxInstructionsLabel}
            onChange={(value) => patch("solanaTxInstructionsLabel", value)}
          />
          <BodyField
            id="solana-tx-sim-warning"
            label="Simulation warning"
            value={form.solanaTxSimulationWarning}
            onChange={(value) => patch("solanaTxSimulationWarning", value)}
          />
          <BodyField
            id="solana-tx-nonce-warning"
            label="Durable nonce warning"
            value={form.solanaTxDurableNonceWarning}
            onChange={(value) => patch("solanaTxDurableNonceWarning", value)}
          />
          <TextField
            id="solana-tx-reject"
            label="Reject"
            value={form.solanaTxRejectLabel}
            onChange={(value) => patch("solanaTxRejectLabel", value)}
          />
          <TextField
            id="solana-tx-sign"
            label="Sign"
            value={form.solanaTxSignLabel}
            onChange={(value) => patch("solanaTxSignLabel", value)}
          />
          <TextField
            id="solana-tx-send"
            label="Sign & send"
            value={form.solanaTxSignAndSendLabel}
            onChange={(value) => patch("solanaTxSignAndSendLabel", value)}
          />
          <TextField
            id="solana-tx-hint"
            label="Signing hint"
            value={form.solanaTxSigningHint}
            onChange={(value) => patch("solanaTxSigningHint", value)}
          />
          <TextField
            id="solana-tx-submitting"
            label="Submitting hint"
            value={form.solanaTxSubmittingHint}
            onChange={(value) => patch("solanaTxSubmittingHint", value)}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="siws">
        <AccordionTrigger>Sign-in (SIWS)</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-3">
          <TextField
            id="siws-title"
            label="Title"
            value={form.siwsTitle}
            onChange={(value) => patch("siwsTitle", value)}
          />
          <BodyField
            id="siws-body"
            label="Body"
            value={form.siwsBody}
            onChange={(value) => patch("siwsBody", value)}
          />
          <TextField
            id="siws-network"
            label="Network label"
            value={form.siwsNetworkLabel}
            onChange={(value) => patch("siwsNetworkLabel", value)}
          />
          <TextField
            id="siws-signing-in-with"
            label="Signing in with"
            value={form.siwsSigningInWithLabel}
            onChange={(value) => patch("siwsSigningInWithLabel", value)}
          />
          <TextField
            id="siws-message"
            label="Message label"
            value={form.siwsMessageLabel}
            onChange={(value) => patch("siwsMessageLabel", value)}
          />
          <TextField
            id="siws-uri"
            label="URI label"
            value={form.siwsUriLabel}
            onChange={(value) => patch("siwsUriLabel", value)}
          />
          <TextField
            id="siws-version"
            label="Version label"
            value={form.siwsVersionLabel}
            onChange={(value) => patch("siwsVersionLabel", value)}
          />
          <TextField
            id="siws-nonce"
            label="Nonce label"
            value={form.siwsNonceLabel}
            onChange={(value) => patch("siwsNonceLabel", value)}
          />
          <TextField
            id="siws-issued-at"
            label="Issued at label"
            value={form.siwsIssuedAtLabel}
            onChange={(value) => patch("siwsIssuedAtLabel", value)}
          />
          <TextField
            id="siws-expiration"
            label="Expiration time label"
            value={form.siwsExpirationTimeLabel}
            onChange={(value) => patch("siwsExpirationTimeLabel", value)}
          />
          <TextField
            id="siws-not-before"
            label="Not before label"
            value={form.siwsNotBeforeLabel}
            onChange={(value) => patch("siwsNotBeforeLabel", value)}
          />
          <TextField
            id="siws-resources"
            label="Resources label"
            value={form.siwsResourcesLabel}
            onChange={(value) => patch("siwsResourcesLabel", value)}
          />
          <TextField
            id="siws-reject"
            label="Reject"
            value={form.siwsRejectLabel}
            onChange={(value) => patch("siwsRejectLabel", value)}
          />
          <TextField
            id="siws-sign"
            label="Sign in"
            value={form.siwsSignLabel}
            onChange={(value) => patch("siwsSignLabel", value)}
          />
          <TextField
            id="siws-signing-hint"
            label="Signing hint"
            value={form.siwsSigningHint}
            onChange={(value) => patch("siwsSigningHint", value)}
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
