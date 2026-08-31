import { useState } from "react";
import { cn } from "@/lib/utils";
import { isSafeHttpsIconUrl } from "../lib/utils/tokenIcons";

export interface ISafeAssetImageProps {
  /** Resolved icon URL (bundled or HTTPS). */
  src: string;
  className?: string;
  alt?: string;
  /** Called when the image fails to load (caller should show fallback). */
  onLoadError?: () => void;
}

/**
 * Image that never executes remote content: `<img>` only, no-referrer.
 * Allows same-origin / data / blob / https sources; rejects other schemes.
 */
export function SafeAssetImage({
  src,
  className,
  alt = "",
  onLoadError,
}: ISafeAssetImageProps) {
  const [failed, setFailed] = useState(false);
  const safe =
    src.startsWith("/") ||
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    isSafeHttpsIconUrl(src);

  if (!safe || failed) {
    return null;
  }

  return (
    <img
      src={src}
      alt={alt}
      aria-hidden={alt === "" ? true : undefined}
      referrerPolicy="no-referrer"
      className={cn(className)}
      onError={() => {
        setFailed(true);
        onLoadError?.();
      }}
    />
  );
}
