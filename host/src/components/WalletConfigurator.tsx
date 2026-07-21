import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPickerField } from "./ColorPickerField";
import {
  ACME_PRESET,
  DEFAULTS_PRESET,
  OCEAN_PRESET,
  buildSetStylePayload,
  type IStyleFormState,
} from "../styleForm";

export interface IWalletConfiguratorProps {
  /** When false, apply/presets are disabled (wallet not connected yet). */
  ready: boolean;
  onApply: (options: Record<string, unknown>) => Promise<void>;
}

function TextField({
  id,
  label,
  value,
  onChange,
  mono = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        spellCheck={mono ? false : undefined}
        className={mono ? "font-mono text-[0.85rem]" : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function BodyField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea
        id={id}
        value={value}
        rows={3}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/**
 * Host-side style playground for `proxy.rpc("setStyle", …)`.
 * Tabs: Basic (identity), Style (theme colors), Text (modal copy).
 */
export function WalletConfigurator({
  ready,
  onApply,
}: IWalletConfiguratorProps) {
  const [form, setForm] = useState<IStyleFormState>(ACME_PRESET);
  const [status, setStatus] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = <K extends keyof IStyleFormState>(
    key: K,
    value: IStyleFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const apply = async (next?: IStyleFormState) => {
    const payloadForm = next ?? form;
    if (next) setForm(next);
    setBusy(true);
    setIsError(false);
    setStatus("Calling setStyle…");
    try {
      await onApply(buildSetStylePayload(payloadForm));
      setStatus("setStyle applied.");
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "setStyle failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Style configuration">
      <Tabs defaultValue="basic">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="text">Text</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="mt-4 flex flex-col gap-3">
          <TextField
            id="style-logo-url"
            label="Logo URL"
            value={form.logoUrl}
            mono
            onChange={(value) => patch("logoUrl", value)}
          />
          <TextField
            id="style-product-name"
            label="Wallet name"
            value={form.productName}
            onChange={(value) => patch("productName", value)}
          />
          <TextField
            id="style-tagline"
            label="Subtext"
            value={form.tagline}
            onChange={(value) => patch("tagline", value)}
          />
        </TabsContent>

        <TabsContent value="style" className="mt-4 flex flex-col gap-3">
          <ColorPickerField
            id="style-primary"
            label="Primary"
            value={form.primary}
            onChange={(value) => patch("primary", value)}
          />
          <ColorPickerField
            id="style-primary-fg"
            label="Primary FG"
            value={form.primaryForeground}
            onChange={(value) => patch("primaryForeground", value)}
          />
          <ColorPickerField
            id="style-background"
            label="Background"
            value={form.background}
            onChange={(value) => patch("background", value)}
          />
          <ColorPickerField
            id="style-foreground"
            label="Foreground"
            value={form.foreground}
            onChange={(value) => patch("foreground", value)}
          />
          <ColorPickerField
            id="style-muted"
            label="Muted"
            value={form.muted}
            onChange={(value) => patch("muted", value)}
          />
          <ColorPickerField
            id="style-muted-fg"
            label="Muted FG"
            value={form.mutedForeground}
            onChange={(value) => patch("mutedForeground", value)}
          />
          <ColorPickerField
            id="style-border"
            label="Border"
            value={form.border}
            onChange={(value) => patch("border", value)}
          />
          <ColorPickerField
            id="style-accent"
            label="Accent"
            value={form.accent}
            onChange={(value) => patch("accent", value)}
          />
          <ColorPickerField
            id="style-accent-fg"
            label="Accent FG"
            value={form.accentForeground}
            onChange={(value) => patch("accentForeground", value)}
          />
          <TextField
            id="style-radius"
            label="Radius"
            value={form.radius}
            mono
            onChange={(value) => patch("radius", value)}
          />
          <TextField
            id="style-font"
            label="Font family"
            value={form.fontSans}
            mono
            onChange={(value) => patch("fontSans", value)}
          />
          <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5">
            <Label htmlFor="style-dark" className="cursor-pointer">
              Dark mode
            </Label>
            <Switch
              id="style-dark"
              checked={form.dark}
              onCheckedChange={(checked) => patch("dark", checked)}
            />
          </div>
        </TabsContent>

        <TabsContent value="text" className="mt-4">
          <Accordion type="multiple">
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

            <AccordionItem value="cred-offer">
              <AccordionTrigger>Credential offer</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <TextField
                  id="cred-offer-title"
                  label="Title"
                  value={form.credOfferTitle}
                  onChange={(value) => patch("credOfferTitle", value)}
                />
                <BodyField
                  id="cred-offer-body"
                  label="Body"
                  value={form.credOfferBody}
                  onChange={(value) => patch("credOfferBody", value)}
                />
                <TextField
                  id="cred-offer-accept"
                  label="Accept"
                  value={form.credOfferAccept}
                  onChange={(value) => patch("credOfferAccept", value)}
                />
                <TextField
                  id="cred-offer-reject"
                  label="Reject"
                  value={form.credOfferReject}
                  onChange={(value) => patch("credOfferReject", value)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="cred-present">
              <AccordionTrigger>Credential presentation</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <TextField
                  id="cred-present-title"
                  label="Title"
                  value={form.credPresentTitle}
                  onChange={(value) => patch("credPresentTitle", value)}
                />
                <BodyField
                  id="cred-present-body"
                  label="Body"
                  value={form.credPresentBody}
                  onChange={(value) => patch("credPresentBody", value)}
                />
                <TextField
                  id="cred-present-share"
                  label="Share"
                  value={form.credPresentShare}
                  onChange={(value) => patch("credPresentShare", value)}
                />
                <TextField
                  id="cred-present-reject"
                  label="Reject"
                  value={form.credPresentReject}
                  onChange={(value) => patch("credPresentReject", value)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="credentials">
              <AccordionTrigger>Credentials tab</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <TextField
                  id="cred-tab-label"
                  label="Tab label"
                  value={form.credTabLabel}
                  onChange={(value) => patch("credTabLabel", value)}
                />
                <TextField
                  id="cred-empty-count"
                  label="Empty count"
                  value={form.credEmptyCount}
                  onChange={(value) => patch("credEmptyCount", value)}
                />
                <TextField
                  id="cred-count-label"
                  label="Count ({count})"
                  value={form.credCountLabel}
                  onChange={(value) => patch("credCountLabel", value)}
                />
                <BodyField
                  id="cred-empty-body"
                  label="Empty body"
                  value={form.credEmptyBody}
                  onChange={(value) => patch("credEmptyBody", value)}
                />
                <TextField
                  id="cred-refresh"
                  label="Refresh"
                  value={form.credRefresh}
                  onChange={(value) => patch("credRefresh", value)}
                />
                <TextField
                  id="cred-view"
                  label="View"
                  value={form.credView}
                  onChange={(value) => patch("credView", value)}
                />
                <BodyField
                  id="cred-detail-description"
                  label="Detail description"
                  value={form.credDetailDescription}
                  onChange={(value) => patch("credDetailDescription", value)}
                />
                <TextField
                  id="cred-claims-heading"
                  label="Claims heading"
                  value={form.credClaimsHeading}
                  onChange={(value) => patch("credClaimsHeading", value)}
                />
                <TextField
                  id="cred-close"
                  label="Close"
                  value={form.credClose}
                  onChange={(value) => patch("credClose", value)}
                />
              </AccordionContent>
            </AccordionItem>

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
                  id="transfer-tokens-sent-title"
                  label="Transfer sent title"
                  value={form.transferTokensSentTitle}
                  onChange={(value) => patch("transferTokensSentTitle", value)}
                />
                <TextField
                  id="transfer-tokens-view-explorer"
                  label="Transfer view on explorer"
                  value={form.transferTokensViewExplorer}
                  onChange={(value) =>
                    patch("transferTokensViewExplorer", value)
                  }
                />
                <TextField
                  id="transfer-tokens-done"
                  label="Transfer done"
                  value={form.transferTokensDone}
                  onChange={(value) => patch("transferTokensDone", value)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="backup">
              <AccordionTrigger>Create backup</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <TextField
                  id="backup-title"
                  label="Title"
                  value={form.backupTitle}
                  onChange={(value) => patch("backupTitle", value)}
                />
                <BodyField
                  id="backup-body"
                  label="Body"
                  value={form.backupBody}
                  onChange={(value) => patch("backupBody", value)}
                />
                <TextField
                  id="backup-continue"
                  label="Continue"
                  value={form.backupContinue}
                  onChange={(value) => patch("backupContinue", value)}
                />
                <TextField
                  id="backup-cancel"
                  label="Cancel"
                  value={form.backupCancel}
                  onChange={(value) => patch("backupCancel", value)}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="restore">
              <AccordionTrigger>Restore backup</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <TextField
                  id="restore-title"
                  label="Title"
                  value={form.restoreTitle}
                  onChange={(value) => patch("restoreTitle", value)}
                />
                <BodyField
                  id="restore-body"
                  label="Body"
                  value={form.restoreBody}
                  onChange={(value) => patch("restoreBody", value)}
                />
                <TextField
                  id="restore-label"
                  label="Restore"
                  value={form.restoreLabel}
                  onChange={(value) => patch("restoreLabel", value)}
                />
                <TextField
                  id="restore-cancel"
                  label="Cancel"
                  value={form.restoreCancel}
                  onChange={(value) => patch("restoreCancel", value)}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          disabled={!ready || busy}
          onClick={() => {
            void apply();
          }}
        >
          Apply setStyle
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            void apply(OCEAN_PRESET);
          }}
        >
          Preset: ocean
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            void apply(DEFAULTS_PRESET);
          }}
        >
          Preset: defaults
        </Button>
      </div>

      <p
        className={`min-h-5 text-sm ${isError ? "text-destructive" : "text-muted-foreground"}`}
        aria-live="polite"
      >
        {status}
      </p>
    </section>
  );
}
