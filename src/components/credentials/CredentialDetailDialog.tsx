import { useEffect, useState } from "react";
import { PresentationUtils, type StoredCredential } from "@1shotapi/ows-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useStyle } from "../../style";

function formatClaimValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function resolveClaims(
  credential: StoredCredential,
): Promise<Record<string, unknown>> {
  const format = credential.format;
  if (format.includes("sd-jwt") || credential.payload.includes("~")) {
    try {
      return await PresentationUtils.unpackSubject(credential.payload);
    } catch (error: unknown) {
      console.warn("[credentials] unpackSubject failed", error);
    }
  }

  const subject = credential.semantic?.credentialSubject;
  if (subject && typeof subject === "object") {
    return subject;
  }

  try {
    const parsed: unknown = JSON.parse(credential.payload);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // not JSON
  }

  return { payload: credential.payload };
}

export function CredentialDetailDialog({
  credential,
  open,
  onOpenChange,
}: {
  credential: StoredCredential | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { style } = useStyle();
  const { credentials: copy } = style.copy;
  const [claims, setClaims] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!credential || !open) {
      setClaims(null);
      return;
    }

    let cancelled = false;
    void resolveClaims(credential).then((next) => {
      if (!cancelled) setClaims(next);
    });
    return () => {
      cancelled = true;
    };
  }, [credential, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,34rem)] max-w-[calc(100%-1.5rem)] gap-3 overflow-y-auto sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {credential?.type.join(", ") ?? copy.detailFallbackTitle}
          </DialogTitle>
          <DialogDescription>{copy.detailDescription}</DialogDescription>
        </DialogHeader>

        {credential ? (
          <div className="flex flex-col gap-3 text-sm">
            <dl className="grid gap-2">
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  {copy.issuerLabel}
                </dt>
                <dd className="break-all">{credential.issuer}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  {copy.formatLabel}
                </dt>
                <dd className="font-mono text-xs">{credential.format}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  {copy.issuedLabel}
                </dt>
                <dd className="font-mono text-xs">{credential.issuedAt}</dd>
              </div>
              {credential.validUntil ? (
                <div>
                  <dt className="text-muted-foreground text-xs font-medium uppercase">
                    {copy.validUntilLabel}
                  </dt>
                  <dd className="font-mono text-xs">
                    {credential.validUntil}
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-muted-foreground text-xs font-medium uppercase">
                  {copy.idLabel}
                </dt>
                <dd className="font-mono text-xs break-all">
                  {credential.credentialId}
                </dd>
              </div>
            </dl>

            <div>
              <h3 className="mb-1.5 text-xs font-medium tracking-wide uppercase">
                {copy.claimsHeading}
              </h3>
              {claims === null ? (
                <p className="text-muted-foreground text-xs">
                  {copy.claimsLoading}
                </p>
              ) : Object.keys(claims).length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  {copy.claimsEmpty}
                </p>
              ) : (
                <ul className="m-0 grid list-none gap-1.5 p-0">
                  {Object.entries(claims).map(([key, value]) => (
                    <li
                      key={key}
                      className="border-border bg-muted/40 rounded-md border px-2.5 py-2"
                    >
                      <p className="text-muted-foreground m-0 text-[0.7rem] font-medium tracking-wide uppercase">
                        {key}
                      </p>
                      <p className="m-0 break-all font-mono text-xs">
                        {formatClaimValue(value)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}

        <DialogFooter showCloseButton={false} className="sm:justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {copy.closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
