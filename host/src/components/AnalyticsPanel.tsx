import { useMemo, useState } from "react";
import type { IOWSAnalyticsEvent } from "@1shotapi/ows-types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MAX_VISIBLE = 50;

export interface IAnalyticsPanelProps {
  events: IOWSAnalyticsEvent[];
  onClear: () => void;
}

function formatEventTime(timestamp: number): string {
  try {
    return new Date(timestamp * 1000).toLocaleTimeString();
  } catch {
    return String(timestamp);
  }
}

/**
 * Live Branding→Host analytics stream (`proxy.analytics.on`).
 * Shows the full rich payload; narrow with the name filter.
 */
export function AnalyticsPanel({ events, onClear }: IAnalyticsPanelProps) {
  const [nameFilter, setNameFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const names = useMemo(() => {
    const set = new Set<string>();
    for (const event of events) {
      set.add(event.name);
    }
    return [...set].sort();
  }, [events]);

  const filtered = useMemo(() => {
    const list =
      nameFilter === "all"
        ? events
        : events.filter((event) => event.name === nameFilter);
    return list.slice(0, MAX_VISIBLE);
  }, [events, nameFilter]);

  return (
    <Card className="shadow-sm">
      <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle className="font-heading text-xl">Analytics</CardTitle>
          <CardDescription>
            Live <code className="text-xs">proxy.analytics</code> events from
            the Branding Layer. Narrow on <code className="text-xs">name</code>{" "}
            (e.g. <code className="text-xs">PersonalSign</code>). Full rich
            payloads are shown — OWS only types base fields.
          </CardDescription>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Select value={nameFilter} onValueChange={setNameFilter}>
            <SelectTrigger className="w-[11rem]" size="sm">
              <SelectValue placeholder="Filter name" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All names</SelectItem>
              {names.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={events.length === 0}
            onClick={onClear}
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No events yet. Sign, send, create an account, or grant a permission
            to see traffic.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((event) => {
              const id = String(event.eventId);
              const open = expandedId === id;
              return (
                <li
                  key={id}
                  className="border-border overflow-hidden rounded-lg border"
                >
                  <button
                    type="button"
                    className="hover:bg-muted/60 flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
                    onClick={() => setExpandedId(open ? null : id)}
                    aria-expanded={open}
                  >
                    <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 font-mono text-xs font-medium">
                      {event.name}
                    </span>
                    <span className="text-muted-foreground truncate text-xs">
                      {String(event.hostDomain)} · {formatEventTime(event.timestamp)}
                    </span>
                  </button>
                  {open ? (
                    <pre className="bg-muted/40 border-border max-h-64 overflow-auto border-t p-3 font-mono text-[0.7rem] leading-relaxed break-all whitespace-pre-wrap">
                      {JSON.stringify(event, null, 2)}
                    </pre>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
