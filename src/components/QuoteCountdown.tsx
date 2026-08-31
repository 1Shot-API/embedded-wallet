import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export interface IQuoteCountdownProps {
  /** Fetch/format the display value. Called on mount and when the TTL elapses. */
  getNewQuote: () => Promise<string>;
  /** Seconds the quote is considered good. Default 15. */
  ttlSeconds?: number;
  /** Pause countdown (e.g. while submit is in flight). */
  paused?: boolean;
  className?: string;
}

const DEFAULT_TTL_SECONDS = 15;

/**
 * Shows a parent-formatted quote string plus a live TTL countdown.
 * Calls {@link IQuoteCountdownProps.getNewQuote} on mount and when the timer elapses.
 */
export function QuoteCountdown({
  getNewQuote,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  paused = false,
  className,
}: IQuoteCountdownProps) {
  const [value, setValue] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(ttlSeconds);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getNewQuoteRef = useRef(getNewQuote);
  useEffect(() => {
    getNewQuoteRef.current = getNewQuote;
  }, [getNewQuote]);

  const generationRef = useRef(0);
  const inFlightRef = useRef(false);
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const refresh = async (resetTimer: boolean): Promise<void> => {
    if (inFlightRef.current) return;
    const generation = ++generationRef.current;
    inFlightRef.current = true;
    setUpdating(true);
    try {
      const next = await getNewQuoteRef.current();
      if (generation !== generationRef.current) return;
      setValue(next);
      setError(null);
      if (resetTimer) {
        setSecondsLeft(ttlSeconds);
      }
    } catch (err: unknown) {
      if (generation !== generationRef.current) return;
      setError(err instanceof Error ? err.message : "Failed to refresh quote");
      if (resetTimer) {
        setSecondsLeft(ttlSeconds);
      }
    } finally {
      if (generation === generationRef.current) {
        inFlightRef.current = false;
        setUpdating(false);
      }
    }
  };

  // Initial + when getNewQuote identity / ttl changes: fetch immediately.
  useEffect(() => {
    void refresh(true);
    return () => {
      generationRef.current += 1;
    };
    // Intentionally depend on getNewQuote so token/key remounts refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh closes over refs
  }, [getNewQuote, ttlSeconds]);

  // 1s tick; at 0 refresh and reset.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (pausedRef.current || inFlightRef.current) return;
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          void refresh(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- interval uses refs
  }, [ttlSeconds]);

  return (
    <span className={cn("inline-flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-medium", updating && value ? "opacity-70" : undefined)}>
        {value ?? (updating ? "…" : "—")}
      </span>
      {value ? (
        <span className="text-muted-foreground text-xs font-normal">
          {updating && !error
            ? "Updating…"
            : `Quote good for ${Math.max(secondsLeft, 0)}s`}
        </span>
      ) : null}
      {error ? (
        <span className="text-destructive text-xs font-normal" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
