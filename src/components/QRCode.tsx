import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";
import { cn } from "@/lib/utils";
import { useStyle } from "../style";

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
        dark,
        light,
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
