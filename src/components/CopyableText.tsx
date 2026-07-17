import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type CopyState = "idle" | "copied" | "failed";

const TRUNCATE_CHARS = 5;
const FEEDBACK_MS = 1500;

export interface ICopyableTextProps {
  /** Full value to display (and copy). */
  text: string;
  /**
   * When set, show the first and last 5 characters with an ellipsis between.
   * The full `text` is still copied.
   */
  truncate?: boolean;
  className?: string;
  disabled?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  copyFailedLabel?: string;
}

function formatTruncated(text: string): string {
  if (text.length <= TRUNCATE_CHARS * 2 + 1) return text;
  return `${text.slice(0, TRUNCATE_CHARS)}…${text.slice(-TRUNCATE_CHARS)}`;
}

/**
 * Mono text with an inline copy control and brief success/failure feedback.
 * Use `truncate` for compact address rows; omit it for full wrapped blocks (e.g. backup).
 */
export function CopyableText({
  text,
  truncate = false,
  className,
  disabled = false,
  copyLabel = "Copy",
  copiedLabel = "Copied",
  copyFailedLabel = "Copy failed",
}: ICopyableTextProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canCopy = Boolean(text) && text !== "—" && !disabled;

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  const feedbackLabel =
    copyState === "copied"
      ? copiedLabel
      : copyState === "failed"
        ? copyFailedLabel
        : copyLabel;

  const onCopy = () => {
    if (!canCopy) return;
    void copyText(text).then((ok) => {
      setCopyState(ok ? "copied" : "failed");
      if (resetRef.current) clearTimeout(resetRef.current);
      resetRef.current = setTimeout(() => setCopyState("idle"), FEEDBACK_MS);
    });
  };

  const display = truncate ? formatTruncated(text) : text;

  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex min-w-0 gap-2 rounded-lg border",
        truncate ? "items-center px-3 py-2" : "items-start p-3",
        className,
      )}
    >
      <pre
        className={cn(
          "m-0 min-w-0 flex-1 font-mono text-[0.8rem]",
          truncate
            ? "truncate"
            : "max-h-40 overflow-x-hidden overflow-y-auto break-all whitespace-pre-wrap",
        )}
        title={truncate ? text : undefined}
      >
        {display}
      </pre>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0"
        aria-label={feedbackLabel}
        title={feedbackLabel}
        disabled={!canCopy}
        onClick={onCopy}
      >
        {copyState === "copied" ? (
          <CheckIcon className="size-3.5" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
