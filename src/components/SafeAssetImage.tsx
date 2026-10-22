import { useEffect, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { isSafeAssetIconUrl } from "../lib/utils/tokenIcons";

export interface ISafeAssetImageProps {
  /** Resolved icon URL (bundled or HTTPS). Null/empty/unsafe URLs show {@link fallback}. */
  src?: string | null;
  className?: string;
  alt?: string;
  /** Shown when `src` is missing, unsafe, or fails to load. Omit for blank. */
  fallback?: ReactNode;
}

/**
 * Image that never executes remote content: `<img>` only, no-referrer.
 * Allows same-origin / data / blob / https sources; rejects other schemes.
 */
export function SafeAssetImage({
  src,
  className,
  alt = "",
  fallback,
}: ISafeAssetImageProps) {
  const [failed, setFailed] = useState(false);
  const trimmed = src?.trim();
  const canLoad = Boolean(trimmed && isSafeAssetIconUrl(trimmed) && !failed);

  useEffect(() => {
    setFailed(false);
  }, [trimmed]);

  if (canLoad && trimmed) {
    return (
      <img
        src={trimmed}
        alt={alt}
        aria-hidden={alt === "" ? true : undefined}
        referrerPolicy="no-referrer"
        className={cn(className)}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  return null;
}
