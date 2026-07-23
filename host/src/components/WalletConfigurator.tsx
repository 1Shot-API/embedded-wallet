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
  buildSetStylePayload,
  type IStyleFormState,
} from "../styleForm";

export interface IWalletConfiguratorProps {
  /** When false, apply/presets are disabled (wallet not connected yet). */
  ready: boolean;
  onApply: (options: Record<string, unknown>) => Promise<void>;
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
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">
              Allowed chains
            </legend>
            <p className="text-muted-foreground text-xs">
              Leave all unchecked to allow every catalog network. Checking any
              restricts the wallet Network dropdown via{" "}
              <code className="text-[0.7rem]">setStyle.allowedChains</code>.
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
