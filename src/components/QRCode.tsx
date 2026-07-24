import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";
import { cn } from "@/lib/utils";
import { useStyle } from "../style/StyleProvider";

export interface IQRCodeProps {
  /** Payload encoded in the QR (e.g. a wallet address). */
  value: string;
  /** Rendered square size in CSS pixels. */
  size?: number;
  className?: string;
  /** Accessible label for the generated image. */
  alt?: string;
}

/**
 * Resolve a CSS color (oklch, rgb, named, …) to `#rrggbb` for the `qrcode`
 * library, which only accepts hex.
 */
function cssColorToHex(color: string, fallback: string): string {
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed;
  if (/^#[0-9a-fA-F]{3}$/.test(trimmed)) {
    const [, r, g, b] = trimmed;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (typeof document === "undefined") return fallback;

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return fallback;

  ctx.fillStyle = "#000000";
  ctx.fillStyle = trimmed;
  const resolved = ctx.fillStyle;

  if (/^#[0-9a-fA-F]{6}$/i.test(resolved)) return resolved;

  const rgb = resolved.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i,
  );
  if (!rgb) return fallback;
  const toHex = (n: string) =>
    Math.round(Number(n)).toString(16).padStart(2, "0");
  return `#${toHex(rgb[1])}${toHex(rgb[2])}${toHex(rgb[3])}`;
}

/**
 * Renders a QR code for `value`. All QR encoding lives in this module.
 * Module/quiet-zone colors follow host `setStyle` theme foreground/background.
 */
export function QRCode({
  value,
  size = 192,
  className,
  alt = "QR code",
}: IQRCodeProps) {
  const { style } = useStyle();
  const dark = style.theme.foreground;
  const light = style.theme.background;
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!value) {
      setDataUrl(null);
      setError(false);
      return;
    }

    let cancelled = false;
    setError(false);

    void QRCodeLib.toDataURL(value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: "M",
      color: {
        dark: cssColorToHex(dark, "#000000"),
        light: cssColorToHex(light, "#ffffff"),
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) {
          setDataUrl(null);
          setError(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [value, size, dark, light]);

  if (!value || error) {
    return (
      <div
        className={cn(
          "bg-muted text-muted-foreground flex items-center justify-center rounded-lg text-sm",
          className,
        )}
        style={{ width: size, height: size }}
        role="img"
        aria-label={alt}
      >
        —
      </div>
    );
  }

  if (!dataUrl) {
    return (
      <div
        className={cn("bg-muted animate-pulse rounded-lg", className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt={alt}
      className={cn("bg-background rounded-lg p-2", className)}
    />
  );
}
