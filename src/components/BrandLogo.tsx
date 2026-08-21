import { cn } from "@/lib/utils";
import defaultLogoUrl from "../assets/1Shot-Icon-New.svg";

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
  const src = logoUrl?.trim() ? logoUrl : defaultLogoUrl;

  return (
    <img
      src={src}
      alt={alt}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
