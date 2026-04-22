const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  upcoming: {
    label: "Upcoming",
    className: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  active: {
    label: "Active",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  used: {
    label: "Used",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  expired: {
    label: "Expired",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
  },
  pending_payment: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
};

const PASS_TYPE_LABELS: Record<string, string> = {
  day: "Day Pass",
  week: "Week Pass",
};

interface PassCardProps {
  pass: {
    id: string;
    pass_type: string;
    status: string;
    start_date: string;
    end_date: string;
    amount_cents: number;
    assigned_desk_id: string | null;
    created_at: string | null;
    desk: { name: string } | null;
  };
  currency: string;
}

export function PassCard({ pass, currency }: PassCardProps) {
  const badge = STATUS_BADGE[pass.status] ?? {
    label: pass.status,
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/40 dark:text-zinc-400",
  };

  const typeLabel = PASS_TYPE_LABELS[pass.pass_type] ?? pass.pass_type;

  const isSingleDay = pass.start_date === pass.end_date;
  const dateDisplay = isSingleDay
    ? formatDate(pass.start_date)
    : `${formatDate(pass.start_date)} - ${formatDate(pass.end_date)}`;

  const amountDisplay = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(pass.amount_cents / 100);

  return (
    <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-4 shadow-[var(--glass-shadow)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{typeLabel}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{dateDisplay}</p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span>{amountDisplay}</span>
        {pass.desk && (
          <span className="truncate">Desk: {pass.desk.name}</span>
        )}
      </div>
    </div>
  );
}

function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
