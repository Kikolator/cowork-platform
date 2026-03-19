import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
}: {
  label: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">
        {value}
      </p>
      {description && (
        <p
          className={cn(
            "mt-1 text-xs",
            trend === "up" && "text-green-400",
            trend === "down" && "text-red-400",
            (!trend || trend === "neutral") && "text-muted-foreground"
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
}
