import type {
  EVMAccountAddress,
  EVMChainId,
} from "@1shotapi/ows-types";
import { cn } from "@/lib/utils";
import { resolveAssetIconUrl } from "../lib/utils/tokenIcons";

export interface IAssetIdentityMarkProps {
  chainId: EVMChainId;
  address: EVMAccountAddress;
  symbol: string;
  chainLogoUrl?: string;
  className?: string;
}

/** Large token icon with optional chain logo badge at bottom-right. */
export function AssetIdentityMark({
  chainId,
  address,
  symbol,
  chainLogoUrl,
  className,
}: IAssetIdentityMarkProps) {
  const iconUrl = resolveAssetIconUrl(chainId, address, symbol);
  const letter = (symbol.trim()[0] ?? "?").toUpperCase();

  return (
    <div className={cn("relative size-16 shrink-0", className)} aria-hidden>
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          className="size-16 rounded-full object-cover"
        />
      ) : (
        <div className="bg-muted text-foreground flex size-16 items-center justify-center rounded-full text-2xl font-semibold">
          {letter}
        </div>
      )}
      {chainLogoUrl ? (
        <img
          src={chainLogoUrl}
          alt=""
          className="border-background absolute -right-0.5 -bottom-0.5 size-6 rounded-full border-2 object-cover"
        />
      ) : null}
    </div>
  );
}
