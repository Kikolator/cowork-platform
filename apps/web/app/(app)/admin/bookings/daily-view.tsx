"use client";

import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { adminCheckIn, adminCheckOut, adminCancelBooking, getDailyBookings } from "./actions";
import { WalkInDialog } from "./walk-in-dialog";

interface Booking {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string;
  status: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  credits_deducted: number | null;
  resource: {
    id: string;
    name: string;
    resource_type: { slug: string; name: string };
  };
}

interface Pass {
  id: string;
  user_id: string;
  pass_type: string;
  status: string;
  start_date: string;
  end_date: string;
  assigned_desk_id: string | null;
  desk_name: string | null;
}

interface FixedDeskMember {
  id: string;
  user_id: string;
  fixed_desk_id: string | null;
  desk_name: string | null;
}

interface ProfileMap {
  [userId: string]: { full_name: string | null; email: string };
}

interface DailyViewProps {
  initialBookings: Booking[];
  initialPasses: Pass[];
  initialFixedDeskMembers: FixedDeskMember[];
  initialProfileMap: ProfileMap;
  initialDate: string;
  timezone: string;
}

export function DailyView({
  initialBookings,
  initialPasses,
  initialFixedDeskMembers,
  initialProfileMap,
  initialDate,
  timezone,
}: DailyViewProps) {
  const [date, setDate] = useState(initialDate);
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [passes, setPasses] = useState<Pass[]>(initialPasses);
  const [fixedDeskMembers, setFixedDeskMembers] = useState<FixedDeskMember[]>(initialFixedDeskMembers);
  const [profileMap, setProfileMap] = useState<ProfileMap>(initialProfileMap);
  const [isPending, startTransition] = useTransition();

  // Group bookings by resource type
  const deskBookings = bookings.filter(
    (b) => b.resource.resource_type.slug === "desk",
  );
  const roomBookings = bookings.filter(
    (b) => b.resource.resource_type.slug !== "desk",
  );

  // Group room bookings by resource
  const roomsByResource = new Map<string, Booking[]>();
  for (const b of roomBookings) {
    const key = b.resource.name;
    if (!roomsByResource.has(key)) roomsByResource.set(key, []);
    roomsByResource.get(key)!.push(b);
  }

  async function applyDaily(d: string) {
    const result = await getDailyBookings(d);
    setBookings(result.bookings as unknown as Booking[]);
    setPasses(result.passes as Pass[]);
    setFixedDeskMembers(result.fixedDeskMembers as FixedDeskMember[]);
    setProfileMap(result.profileMap);
  }

  function refreshDaily() {
    startTransition(() => applyDaily(date));
  }

  function changeDate(delta: number) {
    const d = new Date(date + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + delta);
    const newDate = d.toISOString().slice(0, 10);
    setDate(newDate);
    startTransition(() => applyDaily(newDate));
  }

  function handleCheckIn(bookingId: string) {
    startTransition(async () => {
      await adminCheckIn(bookingId);
      await applyDaily(date);
    });
  }

  function handleCheckOut(bookingId: string) {
    startTransition(async () => {
      await adminCheckOut(bookingId);
      await applyDaily(date);
    });
  }

  function handleCancel(bookingId: string, userId: string) {
    startTransition(async () => {
      await adminCancelBooking(bookingId, userId);
      await applyDaily(date);
    });
  }

  const dateFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  function getMemberName(userId: string): string {
    const profile = profileMap[userId];
    return profile?.full_name ?? profile?.email ?? "Unknown";
  }

  const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    confirmed: { label: "Upcoming", className: "" },
    checked_in: {
      label: "In",
      className:
        "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    },
    completed: {
      label: "Done",
      className:
        "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400",
    },
  };

  const totalDeskOccupancy = deskBookings.length + fixedDeskMembers.length + passes.filter((p) => p.assigned_desk_id).length;

  return (
    <div>
      {/* Date navigation + Walk-in button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => changeDate(-1)}
          disabled={isPending}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-semibold">
          {dateFmt.format(new Date(date + "T12:00:00Z"))}
        </h2>
        <Button
          variant="outline"
          size="icon-xs"
          onClick={() => changeDate(1)}
          disabled={isPending}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {isPending && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}

        <div className="ml-auto">
          <WalkInDialog date={date} onCreated={() => refreshDaily()} />
        </div>
      </div>

      {/* Desks section — bookings + fixed desk members */}
      <div className="mt-6">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Desks ({totalDeskOccupancy} occupied)
        </h3>

        {totalDeskOccupancy === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No desk activity</p>
        ) : (
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Desk</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-24">Type</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* Fixed desk members */}
                {fixedDeskMembers.map((m) => (
                  <TableRow key={`fixed-${m.id}`}>
                    <TableCell className="font-medium">
                      {m.desk_name ?? "Desk"}
                    </TableCell>
                    <TableCell>{getMemberName(m.user_id)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300"
                      >
                        Fixed
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Assigned
                      </Badge>
                    </TableCell>
                    <TableCell />
                  </TableRow>
                ))}

                {/* Pass holders with assigned desks */}
                {passes
                  .filter((p) => p.assigned_desk_id)
                  .map((p) => (
                    <TableRow key={`pass-${p.id}`}>
                      <TableCell className="font-medium">
                        {p.desk_name ?? "Desk"}
                      </TableCell>
                      <TableCell>{getMemberName(p.user_id)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                        >
                          {p.pass_type === "day" ? "Day Pass" : "Week Pass"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          Active
                        </Badge>
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ))}

                {/* Desk bookings */}
                {deskBookings.map((b) => {
                  const status = STATUS_BADGE[b.status] ?? STATUS_BADGE.confirmed!;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">
                        {b.resource.name}
                      </TableCell>
                      <TableCell>{getMemberName(b.user_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">Booking</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleCheckIn(b.id)}
                              disabled={isPending}
                            >
                              Check In
                            </Button>
                          )}
                          {b.status === "checked_in" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleCheckOut(b.id)}
                              disabled={isPending}
                            >
                              Check Out
                            </Button>
                          )}
                          {b.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleCancel(b.id, b.user_id)}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Day Passes section — pass holders without assigned desks */}
      {passes.filter((p) => !p.assigned_desk_id).length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Day Passes ({passes.filter((p) => !p.assigned_desk_id).length} active)
          </h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead className="w-28">Pass Type</TableHead>
                  <TableHead className="w-28">Valid Until</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {passes
                  .filter((p) => !p.assigned_desk_id)
                  .map((p) => (
                    <TableRow key={`pass-noDesk-${p.id}`}>
                      <TableCell>{getMemberName(p.user_id)}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300"
                        >
                          {p.pass_type === "day" ? "Day Pass" : "Week Pass"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {p.end_date}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Rooms section */}
      {[...roomsByResource.entries()].map(([roomName, roomBookingsList]) => (
        <div key={roomName} className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {roomName} ({roomBookingsList.length} bookings)
          </h3>
          <div className="mt-2 overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Time</TableHead>
                  <TableHead>Member</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {roomBookingsList.map((b) => {
                  const status = STATUS_BADGE[b.status] ?? STATUS_BADGE.confirmed!;
                  return (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium tabular-nums">
                        {timeFmt.format(new Date(b.start_time))} –{" "}
                        {timeFmt.format(new Date(b.end_time))}
                      </TableCell>
                      <TableCell>{getMemberName(b.user_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={status.className}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {b.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleCheckIn(b.id)}
                              disabled={isPending}
                            >
                              Check In
                            </Button>
                          )}
                          {b.status === "checked_in" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => handleCheckOut(b.id)}
                              disabled={isPending}
                            >
                              Check Out
                            </Button>
                          )}
                          {b.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive hover:text-destructive"
                              onClick={() => handleCancel(b.id, b.user_id)}
                              disabled={isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {bookings.length === 0 && fixedDeskMembers.length === 0 && passes.length === 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">
            No bookings on this date.
          </p>
        </div>
      )}
    </div>
  );
}
