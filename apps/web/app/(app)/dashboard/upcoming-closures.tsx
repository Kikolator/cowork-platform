import { AlertTriangle } from "lucide-react";
import { formatBookingDate } from "@/lib/booking/format";

interface Closure {
  id: string;
  date: string;
  all_day: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
}

export function UpcomingClosures({
  closures,
  timezone,
}: {
  closures: Closure[];
  timezone: string;
}) {
  return (
    <div>
      <h3 className="text-lg font-medium text-foreground">Notices</h3>
      <div className="mt-3 space-y-2">
        {closures.map((closure) => (
          <div
            key={closure.id}
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                {closure.all_day
                  ? "Closed all day"
                  : `Closed ${closure.start_time ?? ""} – ${closure.end_time ?? ""}`}
                {" · "}
                {formatClosureDate(closure.date, timezone)}
              </p>
              {closure.reason && (
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300/70">
                  {closure.reason}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatClosureDate(dateStr: string, timezone: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(d);
}
