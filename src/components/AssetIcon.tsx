import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import { cn } from "@/lib/utils";
import { resolveAssetIconUrl } from "../lib/utils/tokenIcons";

export interface IAssetIconProps {
  chainId: EVMChainId;
  address: EVMAccountAddress;
  symbol: string;
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
  size = "sm",
  className,
}: IAssetIconProps) {
  const iconUrl = resolveAssetIconUrl(chainId, address, symbol);
  const sizeClass = SIZE_CLASSES[size];

  if (iconUrl) {
    return (
      <img
        src={iconUrl}
        alt=""
        aria-hidden
        className={cn("shrink-0 rounded-full object-cover", sizeClass, className)}
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
