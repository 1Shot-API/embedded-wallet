import { useEffect, useState } from "react";
import QRCodeLib from "qrcode";
import { cn } from "@/lib/utils";

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
 */
export function QRCode({
  value,
  size = 192,
  className,
  alt = "QR code",
}: IQRCodeProps) {
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
        dark: "#000000",
        light: "#ffffff",
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
  }, [value, size]);

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
      className={cn("rounded-lg bg-white p-2", className)}
    />
  );
}
