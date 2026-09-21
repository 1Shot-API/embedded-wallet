import type { ReactNode } from "react";
import { ExternalLinkIcon } from "lucide-react";
import { faviconUrl, truncateAddress } from "../../lib/utils/identityDisplay";
import { ConsentSummaryRow } from "../ConsentSummaryRow";
import { SafeAssetImage } from "../SafeAssetImage";

const grantCardClassName =
  "border-border flex flex-col gap-2.5 rounded-md border px-3 py-2.5";

/** Host context: requesting app URL and optional justification. */
export function PermissionGrantHostCard({
  domain,
  message,
  children,
}: {
  domain: string;
  message?: string;
  /** Request-level rows (e.g. delegate account, network). */
  children?: ReactNode;
}) {
  return (
    <div className={grantCardClassName}>
      <div className="flex min-w-0 items-center gap-2">
        <SafeAssetImage
          src={faviconUrl(domain)}
          className="size-4 shrink-0 rounded-sm"
        />
        <span className="truncate text-sm font-semibold" title={domain}>
          {domain}
        </span>
      </div>
      {message ? (
        <p className="text-muted-foreground m-0 text-sm leading-snug text-pretty">
          {message}
        </p>
      ) : null}
      {children ? (
        <dl className="border-border m-0 flex flex-col gap-2.5 border-t pt-2.5">
          {children}
        </dl>
      ) : null}
    </div>
  );
}

/** Shared request-level rows (delegate + source network) for all permission types. */
export function PermissionGrantHostContextRows({
  toLabel,
  chainLabel,
  viewOnExplorerLabel,
  delegateAddress,
  delegateExplorerUrl,
  chainLogoUrl,
  chainDisplayLabel,
}: {
  toLabel: string;
  chainLabel: string;
  viewOnExplorerLabel: string;
  delegateAddress: string;
  delegateExplorerUrl: string | undefined;
  chainLogoUrl: string | undefined;
  chainDisplayLabel: string;
}) {
  return (
    <>
      <ConsentSummaryRow label={toLabel}>
        {delegateExplorerUrl ? (
          <a
            href={delegateExplorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary flex min-w-0 items-center gap-1 font-mono text-sm underline underline-offset-2"
            title={delegateAddress}
            aria-label={`${viewOnExplorerLabel}: ${delegateAddress}`}
          >
            <span className="truncate">{truncateAddress(delegateAddress)}</span>
            <ExternalLinkIcon className="size-3.5 shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="truncate font-mono text-sm" title={delegateAddress}>
            {truncateAddress(delegateAddress)}
          </span>
        )}
      </ConsentSummaryRow>
      <ConsentSummaryRow label={chainLabel}>
        <SafeAssetImage
          src={chainLogoUrl}
          className="size-5 shrink-0 rounded-full object-cover"
        />
        <span className="truncate text-sm font-medium">{chainDisplayLabel}</span>
      </ConsentSummaryRow>
    </>
  );
}

/** Permission terms: user-facing permission name and read-only summary rows. */
export function PermissionGrantTermsCard({
  kindLabel,
  intro,
  children,
}: {
  kindLabel: string;
  intro?: string;
  children: ReactNode;
}) {
  return (
    <div className={grantCardClassName}>
      <p className="text-primary m-0 text-[0.65rem] font-semibold tracking-wide uppercase">
        {kindLabel}
      </p>
      {intro ? (
        <p className="text-muted-foreground m-0 text-sm leading-snug text-pretty">
          {intro}
        </p>
      ) : null}
      <dl className="m-0 flex flex-col gap-2.5">{children}</dl>
    </div>
  );
}
