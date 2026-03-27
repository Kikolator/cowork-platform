"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { X, Plus } from "lucide-react";
import { cancelPass, createManualPass } from "./actions";

interface Pass {
  id: string;
  pass_type: "day" | "week";
  status: string;
  start_date: string;
  end_date: string;
  amount_cents: number;
  is_guest: boolean;
  purchased_by: string | null;
  assigned_desk_id: string | null;
  created_at: string | null;
  user: { full_name: string | null; email: string } | null;
  desk: { name: string } | null;
  purchaser: { full_name: string | null; email: string } | null;
}

interface SpaceUser {
  id: string;
  full_name: string | null;
  email: string;
}

interface PassesTableProps {
  passes: Pass[];
  spaceUsers: SpaceUser[];
}

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  pending_payment: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  used: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  expired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  pending_payment: "Pending",
  used: "Used",
  cancelled: "Cancelled",
  expired: "Expired",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPrice(cents: number): string {
  if (cents === 0) return "Free";
  return `\u20AC${(cents / 100).toFixed(2)}`;
}

function getTodayString(): string {
  return new Date().toISOString().split("T")[0]!;
}

export function PassesTable({ passes, spaceUsers }: PassesTableProps) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [cancelTarget, setCancelTarget] = useState<Pass | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createUserId, setCreateUserId] = useState("");
  const [createPassType, setCreatePassType] = useState<"day" | "week">("day");
  const [createDate, setCreateDate] = useState(getTodayString());
  const [createError, setCreateError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = passes.filter((pass) => {
    if (statusFilter !== "all" && pass.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      const name = pass.user?.full_name?.toLowerCase() ?? "";
      const email = pass.user?.email?.toLowerCase() ?? "";
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    return true;
  });

  function handleCancel() {
    if (!cancelTarget) return;
    setCancelError(null);
    startTransition(async () => {
      const result = await cancelPass(cancelTarget.id);
      if (!result.success) {
        setCancelError(result.error);
      } else {
        setCancelTarget(null);
      }
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!createUserId) {
      setCreateError("Please select a user");
      return;
    }

    startTransition(async () => {
      const result = await createManualPass(createUserId, createPassType, createDate);
      if (!result.success) {
        setCreateError(result.error);
      } else {
        setCreateOpen(false);
        setCreateUserId("");
        setCreatePassType("day");
        setCreateDate(getTodayString());
      }
    });
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={statusFilter}
            onValueChange={(v) => v && setStatusFilter(v)}
            items={[{ value: "all", label: "All Statuses" }, { value: "active", label: "Active" }, { value: "pending_payment", label: "Pending" }, { value: "used", label: "Used" }, { value: "cancelled", label: "Cancelled" }, { value: "expired", label: "Expired" }]}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="pending_payment">Pending</SelectItem>
              <SelectItem value="used">Used</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Create Pass
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">No passes found.</p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Dates</TableHead>
                <TableHead>Desk</TableHead>
                <TableHead className="w-24 text-right">Amount</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((pass) => (
                <TableRow key={pass.id}>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="font-medium">
                        {pass.is_guest ? (
                          <>
                            {pass.user?.full_name ?? pass.user?.email ?? "Guest"}
                            <span className="ml-1 text-xs text-muted-foreground">
                              (Guest)
                            </span>
                          </>
                        ) : (
                          pass.user?.full_name ?? pass.user?.email ?? "Unknown"
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {pass.user?.email}
                      </div>
                      {pass.is_guest && pass.purchaser && (
                        <div className="text-xs text-muted-foreground">
                          Purchased by {pass.purchaser.full_name ?? pass.purchaser.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {pass.pass_type === "day" ? "Day" : "Week"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[pass.status] ?? ""}`}
                    >
                      {STATUS_LABELS[pass.status] ?? pass.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(pass.start_date)}
                    {pass.start_date !== pass.end_date && (
                      <> &rarr; {formatDate(pass.end_date)}</>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {pass.desk?.name ?? "\u2014"}
                  </TableCell>
                  <TableCell className="text-right text-sm tabular-nums">
                    {formatPrice(pass.amount_cents)}
                  </TableCell>
                  <TableCell>
                    {pass.status === "active" && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setCancelTarget(pass)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create manual pass dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setCreateError(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Pass</DialogTitle>
            <DialogDescription>
              Create a complimentary pass for a walk-in or comp.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            {createError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                {createError}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="create-user">User</Label>
              <Select
                value={createUserId}
                onValueChange={(v) => v && setCreateUserId(v)}
                items={spaceUsers.map((u) => ({ value: u.id, label: u.full_name ?? u.email }))}
              >
                <SelectTrigger id="create-user">
                  <SelectValue placeholder="Select a user" />
                </SelectTrigger>
                <SelectContent>
                  {spaceUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name ?? u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-pass-type">Pass Type</Label>
              <Select
                value={createPassType}
                onValueChange={(v) => v && setCreatePassType(v as "day" | "week")}
                items={[{ value: "day", label: "Day Pass" }, { value: "week", label: "Week Pass" }]}
              >
                <SelectTrigger id="create-pass-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day Pass</SelectItem>
                  <SelectItem value="week">Week Pass</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-date">Start Date</Label>
              <Input
                id="create-date"
                type="date"
                value={createDate}
                min={getTodayString()}
                onChange={(e) => setCreateDate(e.target.value)}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creating..." : "Create Pass"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) {
            setCancelTarget(null);
            setCancelError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this pass?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel the pass and unassign the desk. This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {cancelError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {cancelError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Pass</AlertDialogCancel>
            <Button
              onClick={handleCancel}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? "Cancelling..." : "Cancel Pass"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
