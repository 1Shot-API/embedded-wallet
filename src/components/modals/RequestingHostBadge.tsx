import { faviconUrl } from "../../lib/utils/identityDisplay";
import { SafeAssetImage } from "../SafeAssetImage";

/**
 * Wallet-owned "who is asking" pill for host-initiated consent modals.
 *
 * The domain comes from the browser-verified host origin, and this element is
 * not part of the host-configurable copy, so an embedder cannot hide or
 * rename the requester by overriding modal text.
 */
export function RequestingHostBadge({ domain }: { domain: string }) {
  const trimmed = domain.trim();
  if (!trimmed) {
    return null;
  }
  return (
    <span
      className="border-border text-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 self-start rounded-full border px-2.5 py-1 text-sm font-medium"
      title={trimmed}
    >
      <SafeAssetImage
        src={faviconUrl(trimmed)}
        className="size-4 shrink-0 rounded-sm"
      />
      <span className="truncate">{trimmed}</span>
    </span>
  );
}
