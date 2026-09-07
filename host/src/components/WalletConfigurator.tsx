import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ColorPickerField } from "./ColorPickerField";
import { TextField } from "./configuratorFields";
import { WalletConfiguratorTextTab } from "./WalletConfiguratorTextTab";
import {
  ACME_PRESET,
  CATALOG_CHAIN_OPTIONS,
  DEFAULTS_PRESET,
  OCEAN_PRESET,
  buildConfigurePayloadForSection,
  type ConfigurePayloadSection,
  type IStyleFormState,
} from "../styleForm";

export interface IWalletConfiguratorProps {
  /** When false, apply/presets are disabled (wallet not connected yet). */
  ready: boolean;
  onApply: (
    options: Record<string, unknown>,
    applyOptions?: { replace?: boolean },
  ) => Promise<void>;
}

/**
 * Host-side style playground for `proxy.rpc("configure", …)`.
 * Tabs: Basic (identity), Style (theme colors), Text (modal copy).
 */
export function WalletConfigurator({
  ready,
  onApply,
}: IWalletConfiguratorProps) {
  const [form, setForm] = useState<IStyleFormState>(ACME_PRESET);
  const [activeTab, setActiveTab] = useState("basic");
  const [status, setStatus] = useState<string>("");
  const [isError, setIsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const patch = <K extends keyof IStyleFormState>(
    key: K,
    value: IStyleFormState[K],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const apply = async (
    next?: IStyleFormState,
    section: ConfigurePayloadSection = activeTab === "style"
      ? "theme"
      : activeTab === "text"
        ? "copy"
        : "basic",
    applyOptions?: { replace?: boolean },
  ) => {
    const payloadForm = next ?? form;
    if (next) setForm(next);
    setBusy(true);
    setIsError(false);
    setStatus("Calling configure…");
    try {
      const payload =
        applyOptions?.replace || section === "all"
          ? buildConfigurePayloadForSection(payloadForm, "all")
          : buildConfigurePayloadForSection(payloadForm, section);
      await onApply(payload, applyOptions);
      const sectionLabel =
        section === "all"
          ? "full configuration"
          : section === "basic"
            ? "Basic tab"
            : section === "theme"
              ? "Style tab"
              : section === "copy"
                ? "Text tab"
                : "features";
      setStatus(`Applied ${sectionLabel}.`);
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : "Configuration failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-4" aria-label="Style configuration">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          <TextField
            id="style-destination-url"
            label="Status webhook URL"
            value={form.destinationUrl}
            mono
            onChange={(value) => patch("destinationUrl", value)}
          />
          <p className="-mt-2 text-muted-foreground text-xs">
            URL to receive transaction status update webhooks from the{" "}
            <a
              href="https://1shotapi.com/docs/embedded-wallet/webhooks"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              1Shot Relayer
            </a>
            . Leave empty to clear.
          </p>
          <fieldset className="grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Features</legend>
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <Label htmlFor="style-hide-close" className="cursor-pointer">
                  Hide Close Box
                </Label>
                <p className="text-muted-foreground text-xs">
                  Hides the chrome Close (X). Use for Inline hosts where hide
                  is a no-op.
                </p>
              </div>
              <Switch
                id="style-hide-close"
                checked={form.hideCloseBox}
                onCheckedChange={(checked) => patch("hideCloseBox", checked)}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <Label
                  htmlFor="style-disable-credentials"
                  className="cursor-pointer"
                >
                  Disable Credentials
                </Label>
                <p className="text-muted-foreground text-xs">
                  Hides the Credentials tab. Host credential flows still work.
                </p>
              </div>
              <Switch
                id="style-disable-credentials"
                checked={form.disableCredentials}
                onCheckedChange={(checked) =>
                  patch("disableCredentials", checked)
                }
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="grid gap-0.5">
                <Label
                  htmlFor="style-disable-delegations"
                  className="cursor-pointer"
                >
                  Disable Delegations
                </Label>
                <p className="text-muted-foreground text-xs">
                  Hides the Delegations tab. Host delegation flows still work.
                </p>
              </div>
              <Switch
                id="style-disable-delegations"
                checked={form.disableDelegations}
                onCheckedChange={(checked) =>
                  patch("disableDelegations", checked)
                }
              />
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-medium">Allowed chains</p>
              <p className="text-muted-foreground text-xs">
                Leave all unchecked to allow every catalog network. Checking any
                restricts the wallet Network dropdown via{" "}
                <code className="text-[0.7rem]">
                  configure.features.allowedChains
                </code>
                .
              </p>
              <div className="grid max-h-48 gap-1.5 overflow-y-auto rounded-md border p-2">
                {CATALOG_CHAIN_OPTIONS.map((chain) => {
                  const checked = form.allowedChainIds.includes(chain.chainId);
                  return (
                    <label
                      key={chain.chainId}
                      className="flex cursor-pointer items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          patch(
                            "allowedChainIds",
                            checked
                              ? form.allowedChainIds.filter(
                                  (id) => id !== chain.chainId,
                                )
                              : [...form.allowedChainIds, chain.chainId],
                          );
                        }}
                      />
                      <span>{chain.label}</span>
                      <span className="text-muted-foreground font-mono text-[0.7rem]">
                        {chain.chainId}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          </fieldset>
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

        <WalletConfiguratorTextTab form={form} patch={patch} />
      </Tabs>

      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          disabled={!ready || busy}
          onClick={() => {
            void apply();
          }}
        >
          Apply current tab
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            void apply(OCEAN_PRESET, "all", { replace: true });
          }}
        >
          Preset: ocean
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!ready || busy}
          onClick={() => {
            void apply(DEFAULTS_PRESET, "all", { replace: true });
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
