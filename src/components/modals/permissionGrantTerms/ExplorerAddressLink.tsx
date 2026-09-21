import { ExternalLinkIcon } from "lucide-react";
import { truncateAddress } from "../../../lib/utils/identityDisplay";

export function ExplorerAddressLink({
  address,
  explorerUrl,
  ariaLabel,
}: {
  address: string;
  explorerUrl: string | undefined;
  ariaLabel: string;
}) {
  if (explorerUrl) {
    return (
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary flex min-w-0 items-center gap-1 font-mono text-sm underline underline-offset-2"
        title={address}
        aria-label={ariaLabel}
      >
        <span className="truncate">{truncateAddress(address)}</span>
        <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
      </a>
    );
  }
  return (
    <span className="truncate font-mono text-sm" title={address}>
      {truncateAddress(address)}
    </span>
  );
}
