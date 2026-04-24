"use client";

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
  resource_type: string | null;
  resource_id: string | null;
  metadata: unknown;
  created_at: string | null;
  event_types: {
    description: string;
    category: string;
  } | null;
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

  // Booking: show desk + date
  if (m.desk_name && m.date) {
    return `${m.desk_name} — ${m.date}`;
  }

  return null;
}

export function EventList({ events }: { events: EventRow[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No activity yet.</p>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {events.map((event, i) => {
        const category = event.event_types?.category ?? "system";
        const description =
          event.event_types?.description ?? event.event_type;
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
                {summary && (
                  <p className="text-xs text-muted-foreground">{summary}</p>
                )}
              </div>
            </div>
            <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {event.created_at ? formatTime(event.created_at) : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );
}
