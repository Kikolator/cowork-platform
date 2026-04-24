"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CATEGORY_STYLES: Record<string, string> = {
  member:
    "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  admin:
    "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  billing:
    "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  auth:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  system:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

interface EventRow {
  id: string;
  event_type: string;
  actor_id: string | null;
  actor_type: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: unknown;
  created_at: string | null;
  event_types: {
    description: string;
    category: string;
  } | null;
}

interface EventType {
  slug: string;
  description: string;
  category: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metadataSummary(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  if (m.desk_name && m.date) return `${m.desk_name} — ${m.date}`;
  return null;
}

export function AdminEventList({
  events,
  eventTypes,
  actorNames,
  currentFilter,
}: {
  events: EventRow[];
  eventTypes: EventType[];
  actorNames: Record<string, string>;
  currentFilter?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleFilterChange(value: string | null) {
    if (!value) return;
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("type");
    } else {
      params.set("type", value);
    }
    router.push(`/admin/activity?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by:</span>
        <Select
          value={currentFilter ?? "all"}
          onValueChange={handleFilterChange}
        >
          <SelectTrigger className="w-[280px]">
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All events</SelectItem>
            {eventTypes.map((et) => (
              <SelectItem key={et.slug} value={et.slug}>
                {et.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Event list */}
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {currentFilter
            ? "No events matching this filter."
            : "No events recorded yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border">
          {events.map((event, i) => {
            const category = event.event_types?.category ?? "system";
            const description =
              event.event_types?.description ?? event.event_type;
            const actorName = event.actor_id
              ? actorNames[event.actor_id] ?? "Unknown"
              : event.actor_type;
            const summary = metadataSummary(event.metadata);

            return (
              <div
                key={event.id}
                className={`flex items-start justify-between gap-4 px-4 py-3 ${
                  i < events.length - 1 ? "border-b border-border" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_STYLES[category] ?? CATEGORY_STYLES.system
                    }`}
                  >
                    {category}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{description}</p>
                    <p className="text-xs text-muted-foreground">
                      by {actorName}
                      {summary ? ` — ${summary}` : ""}
                    </p>
                  </div>
                </div>
                <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                  {event.created_at ? formatTime(event.created_at) : "—"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
