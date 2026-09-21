import type { ReactNode } from "react";

/** Label-left / value-right row for consent summary cards (typed data, permissions). */
export function ConsentSummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted-foreground shrink-0 text-xs font-medium tracking-wide uppercase">
        {label}
      </dt>
      <dd className="m-0 flex min-w-0 items-center justify-end gap-2">
        {children}
      </dd>
    </div>
  );
}
