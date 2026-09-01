import { cn } from "@/lib/utils";
import defaultLogoUrl from "../assets/1Shot-Icon-New.svg";
import { SafeAssetImage } from "./SafeAssetImage";

export interface IBrandLogoProps {
  /** Host `configure` logo URL; falls back to the bundled 1Shot icon. */
  logoUrl?: string;
  className?: string;
  alt?: string;
}

export function BrandLogo({
  logoUrl,
  className,
  alt = "",
}: IBrandLogoProps) {
  const imageClassName = cn("shrink-0 object-contain", className);

  return (
    <SafeAssetImage
      src={logoUrl?.trim() || null}
      alt={alt}
      className={imageClassName}
      fallback={
        <img
          src={defaultLogoUrl}
          alt={alt}
          className={imageClassName}
        />
      }
    />
  );
}
