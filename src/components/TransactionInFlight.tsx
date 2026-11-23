import { LoaderCircleIcon } from "lucide-react";

import { CopyableText } from "./CopyableText";

/** One send shown while the user waits. */
export interface ITransactionInFlightEntry {
  amount?: string;
  symbol?: string;
  chainLabel?: string;
  recipient?: string;
  recipientLabel?: string;
  /** Contract or other target when the call is not a transfer. */
  subject?: string;
  subjectLabel?: string;
}

export interface ITransactionInFlightProps {
  status: string;
  entries: ITransactionInFlightEntry[];
  /** Source and destination, for a bridge. */
  route?: string;
  hash?: string;
  hashLabel?: string;
  explorerUrl?: string;
  explorerLabel?: string;
}

/** Replaces the confirm form while a send is signing or waiting on chain. */
export function TransactionInFlight({
  status,
  entries,
  route,
  hash,
  hashLabel,
  explorerUrl,
  explorerLabel,
}: ITransactionInFlightProps) {
  return (
    <div className="text-foreground flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <LoaderCircleIcon
          className="text-muted-foreground size-5 shrink-0 animate-spin"
          aria-hidden
        />
        <p className="m-0 text-sm font-medium">{status}</p>
      </div>
      {route ? <p className="m-0 text-sm font-medium">{route}</p> : null}
      <ul className="m-0 flex list-none flex-col gap-4 p-0">
        {entries.map((entry, index) => (
          <li
            key={`${entry.recipient ?? entry.subject ?? "call"}-${index}`}
            className="flex flex-col gap-2"
          >
            {entry.amount ? (
              <span className="text-xl font-semibold tracking-tight">
                {entry.amount}
                {entry.symbol ? ` ${entry.symbol}` : ""}
              </span>
            ) : null}
            {entry.chainLabel ? (
              <span className="bg-muted text-muted-foreground w-fit rounded-full px-2.5 py-0.5 text-[0.65rem] font-semibold tracking-wide uppercase">
                {entry.chainLabel}
              </span>
            ) : null}
            {entry.subject ? (
              <div className="flex flex-col gap-1.5">
                {entry.subjectLabel ? (
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {entry.subjectLabel}
                  </span>
                ) : null}
                <CopyableText text={entry.subject} truncate />
              </div>
            ) : null}
            {entry.recipient ? (
              <div className="flex flex-col gap-1.5">
                {entry.recipientLabel ? (
                  <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    {entry.recipientLabel}
                  </span>
                ) : null}
                <CopyableText text={entry.recipient} truncate />
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {hash ? (
        <div className="flex min-w-0 flex-col gap-1.5">
          {hashLabel ? (
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {hashLabel}
            </span>
          ) : null}
          <CopyableText text={hash} truncate />
          {explorerUrl && explorerLabel ? (
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary text-xs underline underline-offset-2"
            >
              {explorerLabel}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
