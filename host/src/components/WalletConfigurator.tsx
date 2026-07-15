import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function Field({
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
    <div className="grid grid-cols-[9rem_1fr] items-center gap-x-3 gap-y-1 max-sm:grid-cols-1">
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

/**
 * Host-side style playground for `proxy.rpc("setStyle", …)`.
 * Flat knobs for now — layout/organization can be refined later.
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
    <section className="flex flex-col gap-3" aria-label="Style configuration">
      <div className="flex flex-col gap-2">
        <Field
          id="style-product-name"
          label="Product name"
          value={form.productName}
          onChange={(value) => patch("productName", value)}
        />
        <Field
          id="style-tagline"
          label="Tagline"
          value={form.tagline}
          onChange={(value) => patch("tagline", value)}
        />
        <Field
          id="style-connect-title"
          label="Connect title"
          value={form.connectTitle}
          onChange={(value) => patch("connectTitle", value)}
        />
        <Field
          id="style-connect-continue"
          label="Connect continue"
          value={form.connectContinue}
          onChange={(value) => patch("connectContinue", value)}
        />
        <Field
          id="style-setup-title"
          label="Setup title"
          value={form.setupTitle}
          onChange={(value) => patch("setupTitle", value)}
        />
        <Field
          id="style-setup-create"
          label="Setup create"
          value={form.setupCreate}
          onChange={(value) => patch("setupCreate", value)}
        />
        <Field
          id="style-passkey-title"
          label="Passkey title"
          value={form.passkeyTitle}
          onChange={(value) => patch("passkeyTitle", value)}
        />
        <Field
          id="style-passkey-continue"
          label="Passkey continue"
          value={form.passkeyContinue}
          onChange={(value) => patch("passkeyContinue", value)}
        />
        <Field
          id="style-sign-title"
          label="Sign title"
          value={form.signTitle}
          onChange={(value) => patch("signTitle", value)}
        />
        <Field
          id="style-sign-label"
          label="Sign button"
          value={form.signLabel}
          onChange={(value) => patch("signLabel", value)}
        />
        <Field
          id="style-typed-title"
          label="Typed-data title"
          value={form.typedTitle}
          onChange={(value) => patch("typedTitle", value)}
        />
        <Field
          id="style-cred-offer-title"
          label="Offer title"
          value={form.credOfferTitle}
          onChange={(value) => patch("credOfferTitle", value)}
        />
        <Field
          id="style-cred-present-title"
          label="Present title"
          value={form.credPresentTitle}
          onChange={(value) => patch("credPresentTitle", value)}
        />
        <Field
          id="style-cred-list-title"
          label="List title"
          value={form.credListTitle}
          onChange={(value) => patch("credListTitle", value)}
        />
        <Field
          id="style-backup-title"
          label="Backup title"
          value={form.backupTitle}
          onChange={(value) => patch("backupTitle", value)}
        />
        <Field
          id="style-restore-title"
          label="Restore title"
          value={form.restoreTitle}
          onChange={(value) => patch("restoreTitle", value)}
        />
        <Field
          id="style-primary"
          label="Primary"
          value={form.primary}
          mono
          onChange={(value) => patch("primary", value)}
        />
        <Field
          id="style-primary-fg"
          label="Primary foreground"
          value={form.primaryForeground}
          mono
          onChange={(value) => patch("primaryForeground", value)}
        />
        <Field
          id="style-background"
          label="Background"
          value={form.background}
          mono
          onChange={(value) => patch("background", value)}
        />
        <Field
          id="style-foreground"
          label="Foreground"
          value={form.foreground}
          mono
          onChange={(value) => patch("foreground", value)}
        />
        <Field
          id="style-radius"
          label="Radius"
          value={form.radius}
          mono
          onChange={(value) => patch("radius", value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          id="style-dark"
          type="checkbox"
          className="border-input size-4 rounded border"
          checked={form.dark}
          onChange={(event) => patch("dark", event.target.checked)}
        />
        <span>
          Dark mode (<code className="text-xs">dark: true</code>)
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
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
          Preset: defaults vibe
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
