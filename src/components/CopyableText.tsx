import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";

type CopyState = "idle" | "copied" | "failed";

const MIN_SIDE_CHARS = 4;
const FEEDBACK_MS = 1500;

export interface ICopyableTextProps {
  /** Full value to display (and copy). */
  text: string;
  /**
   * When set, middle-truncate to fit the available width (keeps start + end).
   * The full `text` is still copied.
   */
  truncate?: boolean;
  className?: string;
  disabled?: boolean;
  copyLabel?: string;
  copiedLabel?: string;
  copyFailedLabel?: string;
}

function measureTextWidth(
  text: string,
  font: string,
  canvas: HTMLCanvasElement,
): number {
  const ctx = canvas.getContext("2d");
  if (!ctx) return text.length * 8;
  ctx.font = font;
  return ctx.measureText(text).width;
}

/** Fit `text` into `maxWidth` with a middle ellipsis; prefer showing more chars. */
function formatToWidth(
  text: string,
  maxWidth: number,
  font: string,
  canvas: HTMLCanvasElement,
): string {
  if (maxWidth <= 0) {
    if (text.length <= MIN_SIDE_CHARS * 2 + 1) return text;
    return `${text.slice(0, MIN_SIDE_CHARS)}…${text.slice(-MIN_SIDE_CHARS)}`;
  }
  if (measureTextWidth(text, font, canvas) <= maxWidth) return text;

  const ellipsis = "…";
  const ellipsisWidth = measureTextWidth(ellipsis, font, canvas);
  if (ellipsisWidth >= maxWidth) return ellipsis;

  const maxSide = Math.floor((text.length - 1) / 2);
  let lo = MIN_SIDE_CHARS;
  let hi = maxSide;
  let best = Math.min(MIN_SIDE_CHARS, maxSide);

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    const candidate = `${text.slice(0, mid)}${ellipsis}${text.slice(-mid)}`;
    if (measureTextWidth(candidate, font, canvas) <= maxWidth) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // If even the minimum sides overflow, shrink further.
  if (
    measureTextWidth(
      `${text.slice(0, best)}${ellipsis}${text.slice(-best)}`,
      font,
      canvas,
    ) > maxWidth
  ) {
    for (let side = best - 1; side >= 1; side -= 1) {
      const candidate = `${text.slice(0, side)}${ellipsis}${text.slice(-side)}`;
      if (measureTextWidth(candidate, font, canvas) <= maxWidth) {
        return candidate;
      }
    }
    return ellipsis;
  }

  return `${text.slice(0, best)}${ellipsis}${text.slice(-best)}`;
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
  const [display, setDisplay] = useState(text);
  const resetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textRef = useRef<HTMLPreElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canCopy = Boolean(text) && text !== "—" && !disabled;

  useEffect(() => {
    return () => {
      if (resetRef.current) clearTimeout(resetRef.current);
    };
  }, []);

  useLayoutEffect(() => {
    if (!truncate) {
      setDisplay(text);
      return;
    }

    const el = textRef.current;
    if (!el) {
      setDisplay(text);
      return;
    }

    if (!canvasRef.current) {
      canvasRef.current = document.createElement("canvas");
    }
    const canvas = canvasRef.current;

    const update = () => {
      const font = getComputedStyle(el).font;
      const width = el.clientWidth;
      setDisplay(formatToWidth(text, width, font, canvas));
    };

    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, truncate]);

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

  return (
    <div
      className={cn(
        "border-border bg-muted/40 flex min-w-0 gap-2 rounded-lg border",
        truncate ? "items-center px-3 py-2" : "items-start p-3",
        className,
      )}
    >
      <pre
        ref={textRef}
        className={cn(
          "m-0 min-w-0 flex-1 font-mono text-[0.8rem]",
          truncate
            ? "overflow-hidden whitespace-nowrap"
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
