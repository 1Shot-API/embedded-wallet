import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function LifiLogo({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 65.086 24"
      className={cn("h-6 w-auto shrink-0", className)}
      aria-hidden
    >
      <g fill="currentColor">
        <path d="M 9.958 0 L 14.923 4.965 C 15.512 5.554 15.512 6.508 14.923 7.097 L 11.968 10.052 L 9.958 8.042 C 7.738 5.821 7.738 2.221 9.958 0 Z" />
        <path d="M 9.707 24 L 1.665 15.958 C -0.555 13.737 -0.555 10.137 1.665 7.916 L 8.641 14.892 C 9.23 15.48 10.184 15.48 10.773 14.892 L 17.749 7.916 C 19.969 10.137 19.969 13.737 17.749 15.958 L 9.707 23.999 Z" />
        <path d="M 62.07 18.093 C 62.07 18.093 62.086 7.539 62.07 7.037 C 62.052 6.534 62.564 6.031 63.057 6.031 L 65.085 6.031 L 65.085 17.088 C 65.103 17.59 64.6 18.093 64.098 18.093 Z M 50.008 7.036 L 50.008 18.093 L 53.024 18.093 L 53.024 14.073 L 58.05 14.073 C 58.552 14.073 59.055 13.57 59.055 13.067 L 59.055 11.057 L 53.024 11.057 L 53.024 9.047 L 59.055 9.047 C 59.558 9.047 60.06 8.544 60.06 8.042 L 60.06 6.031 L 51.013 6.031 C 50.511 6.031 50.008 6.534 50.008 7.036 Z M 44.983 16.083 C 44.983 15.581 45.486 15.078 45.988 15.078 L 46.994 15.078 C 47.496 15.078 47.998 15.581 47.998 16.083 L 47.998 17.088 C 47.998 17.59 47.496 18.093 46.993 18.093 L 45.988 18.093 C 45.486 18.093 44.983 17.59 44.983 17.088 Z M 39.957 18.093 C 39.957 18.093 39.973 7.539 39.957 7.037 C 39.939 6.534 40.451 6.031 40.944 6.031 L 42.972 6.031 L 42.972 17.088 C 42.99 17.59 42.487 18.093 41.985 18.093 Z M 27.894 15.078 L 27.894 7.037 C 27.894 6.534 28.331 6.031 28.899 6.031 L 30.909 6.031 L 30.909 15.078 L 37.945 15.078 L 37.945 17.088 C 37.945 17.59 37.443 18.093 36.94 18.093 L 27.894 18.093 Z" />
      </g>
    </svg>
  );
}

export function ExchangeCard({
  headerActions,
  children,
  footer,
}: {
  headerActions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="w-full max-w-[420px] rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <LifiLogo className="text-neutral-900" />
        {headerActions ? (
          <div className="flex items-center gap-1">{headerActions}</div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3">{children}</div>

      <div className="mt-4 flex items-center justify-end gap-1 text-[11px] text-neutral-500">
        <span>Powered by</span>
        <a
          href="https://li.fi"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center text-neutral-700 transition-colors hover:text-neutral-900"
        >
          <LifiLogo className="h-3.5 text-neutral-700" />
        </a>
      </div>

      {footer ? <div className="mt-3">{footer}</div> : null}
    </div>
  );
}
