"use client";

import { useState, useMemo, useTransition } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adminCancelBooking } from "./actions";

interface Booking {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: string;
  credits_deducted: number | null;
  resource: {
    name: string;
    resource_type: { slug: string; name: string };
  };
}

interface ProfileMap {
  [userId: string]: { full_name: string | null; email: string };
}

interface BookingsTableProps {
  bookings: Booking[];
  profileMap: ProfileMap;
  timezone: string;
}

const STATUS_OPTIONS = ["confirmed", "checked_in", "completed", "cancelled", "no_show"] as const;

const STATUS_STYLES: Record<string, string> = {
  confirmed: "",
  checked_in:
    "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  completed:
    "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
  cancelled:
    "border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
  no_show:
    "border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  checked_in: "Checked In",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No Show",
};

export function BookingsTable({ bookings, profileMap, timezone }: BookingsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      // Status filter
      if (statusFilter && b.status !== statusFilter) return false;
      // Search filter
      if (search) {
        const q = search.toLowerCase();
        const profile = profileMap[b.user_id];
        const name = profile?.full_name?.toLowerCase() ?? "";
        const email = profile?.email?.toLowerCase() ?? "";
        const resource = (b.resource as Booking["resource"]).name.toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !resource.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [bookings, search, statusFilter, profileMap]);

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "short",
    day: "numeric",
  });

  function handleCancel() {
    if (!cancelTarget) return;
    startTransition(async () => {
      await adminCancelBooking(cancelTarget.id, cancelTarget.user_id);
      setCancelTarget(null);
    });
  }

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by member or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1">
          <Button
            variant={statusFilter === null ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(null)}
          >
            All
          </Button>
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Resource</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Credits</TableHead>
              <TableHead className="w-28">Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No bookings found
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((b) => {
                const profile = profileMap[b.user_id];
                const resource = b.resource as Booking["resource"];

                return (
                  <TableRow key={b.id}>
                    <TableCell className="tabular-nums">
                      {dateFmt.format(new Date(b.start_time))}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {timeFmt.format(new Date(b.start_time))} – {timeFmt.format(new Date(b.end_time))}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{resource.name}</span>
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        {resource.resource_type.name}
                      </span>
                    </TableCell>
                    <TableCell>
                      {profile?.full_name ?? profile?.email ?? "Unknown"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {b.credits_deducted ?? 0} min
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_STYLES[b.status] ?? ""}>
                        {STATUS_LABELS[b.status] ?? b.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {b.status !== "cancelled" && b.status !== "completed" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-destructive hover:text-destructive"
                          onClick={() => setCancelTarget(b)}
                          disabled={isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Cancel dialog */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the booking and refund any credits deducted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <Button onClick={handleCancel} disabled={isPending} variant="destructive">
              Cancel booking
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
