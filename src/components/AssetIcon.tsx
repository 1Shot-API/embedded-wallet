import { useState } from "react";
import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import { cn } from "@/lib/utils";
import { resolveAssetIconUrl } from "../lib/utils/tokenIcons";
import { SafeAssetImage } from "./SafeAssetImage";

export interface IAssetIconProps {
  chainId: EVMChainId;
  address: EVMAccountAddress;
  symbol: string;
  /** Optional host / tracked override (HTTPS). */
  iconUrl?: string;
  size?: "sm" | "lg";
  className?: string;
}

const SIZE_CLASSES = {
  sm: "size-6 text-[0.65rem]",
  lg: "size-14 text-lg",
} as const;

export function AssetIcon({
  chainId,
  address,
  symbol,
  iconUrl: iconUrlOverride,
  size = "sm",
  className,
}: IAssetIconProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const iconUrl = resolveAssetIconUrl(
    chainId,
    address,
    symbol,
    iconUrlOverride,
  );
  const sizeClass = SIZE_CLASSES[size];

  if (iconUrl && !imageFailed) {
    return (
      <SafeAssetImage
        src={iconUrl}
        className={cn(
          "shrink-0 rounded-full object-cover",
          sizeClass,
          className,
        )}
        onLoadError={() => setImageFailed(true)}
      />
    );
  }

  return (
    <div
      className={cn(
        "bg-primary text-primary-foreground flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      <span>$</span>
    </div>
  );
}
