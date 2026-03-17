"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Search,
  UserPlus,
  MoreHorizontal,
  Pencil,
  Eye,
  Archive,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { archiveLead, updateLeadStatus } from "./actions";
import { LEAD_STATUSES } from "./schemas";
import { LeadDetail } from "./lead-detail";
import { LeadForm } from "./lead-form";

export interface Lead {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  trial_date: string | null;
  trial_confirmed: boolean | null;
  converted_user_id: string | null;
  last_contacted_at: string | null;
  follow_up_count: number | null;
  admin_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  archived_at: string | null;
}

interface LeadsTableProps {
  leads: Lead[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  invited: {
    label: "Invited",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
  confirmed: {
    label: "Confirmed",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  completed: {
    label: "Completed",
    className: "bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
  },
  follow_up: {
    label: "Follow Up",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  converted: {
    label: "Converted",
    className: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  lost: {
    label: "Lost",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

const SOURCE_LABELS: Record<string, string> = {
  website: "Website",
  manual: "Manual",
  referral: "Referral",
  walk_in: "Walk-in",
  event: "Event",
  officernd_import: "OfficeRnD",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

export function LeadsTable({ leads }: LeadsTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [detailLeadId, setDetailLeadId] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Lead | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      // Archived filter
      if (!showArchived && l.archived_at) return false;
      if (showArchived && !l.archived_at) return false;

      // Status filter
      if (statusFilter && l.status !== statusFilter) return false;

      // Text search
      if (search) {
        const q = search.toLowerCase();
        const name = l.full_name?.toLowerCase() ?? "";
        const email = l.email.toLowerCase();
        const company = l.company?.toLowerCase() ?? "";
        if (!name.includes(q) && !email.includes(q) && !company.includes(q)) return false;
      }

      return true;
    });
  }, [leads, search, statusFilter, showArchived]);

  const detailLead = detailLeadId
    ? leads.find((l) => l.id === detailLeadId) ?? null
    : null;

  function handleArchive() {
    if (!archiveTarget) return;
    setArchiveError(null);
    startTransition(async () => {
      const result = await archiveLead(archiveTarget.id);
      if (!result.success) {
        setArchiveError(result.error);
      } else {
        setArchiveTarget(null);
      }
    });
  }

  function handleStatusChange(leadId: string, status: string) {
    startTransition(async () => {
      await updateLeadStatus(leadId, status);
    });
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track and manage prospective members through your pipeline.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="default">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email, or company..."
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
          {LEAD_STATUSES.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setStatusFilter(s)}
            >
              {STATUS_CONFIG[s]?.label ?? s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-archived"
            checked={showArchived}
            onCheckedChange={setShowArchived}
            size="sm"
          />
          <Label htmlFor="show-archived" className="text-sm text-muted-foreground">
            Show archived
          </Label>
        </div>
      </div>

      {/* Table or empty state */}
      {leads.filter((l) => !l.archived_at).length === 0 && !showArchived ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <UserPlus className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">No leads yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Leads are prospective members moving through your pipeline. Add your
            first lead to start tracking.
          </p>
          <Button onClick={() => setCreateOpen(true)} className="mt-5">
            <Plus className="mr-1.5 h-4 w-4" />
            Add your first lead
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[240px]">Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Trial Date</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No leads match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((lead) => {
                  const statusCfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new!;

                  return (
                    <TableRow
                      key={lead.id}
                      className={lead.archived_at ? "bg-muted/30" : ""}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <div className="font-medium truncate">
                            {lead.full_name ?? lead.email}
                          </div>
                          {lead.full_name && (
                            <div className="text-xs text-muted-foreground truncate">
                              {lead.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {lead.company ?? <span className="text-muted-foreground">-</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-transparent ${statusCfg.className}`}
                        >
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {SOURCE_LABELS[lead.source ?? ""] ?? lead.source ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(lead.trial_date)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(lead.created_at)}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-xs" />
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDetailLeadId(lead.id)}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditLead(lead)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit lead
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                Change status
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {LEAD_STATUSES.map((s) => (
                                  <DropdownMenuItem
                                    key={s}
                                    disabled={lead.status === s || isPending}
                                    onClick={() => handleStatusChange(lead.id, s)}
                                  >
                                    {STATUS_CONFIG[s]?.label ?? s}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {!lead.archived_at && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setArchiveTarget(lead)}
                                  className="text-destructive"
                                >
                                  <Archive className="mr-2 h-3.5 w-3.5" />
                                  Archive lead
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create dialog */}
      <LeadForm
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      {/* Edit dialog */}
      {editLead && (
        <LeadForm
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditLead(null);
          }}
          lead={editLead}
        />
      )}

      {/* Detail dialog */}
      {detailLead && (
        <LeadDetail
          open={true}
          onOpenChange={(open) => {
            if (!open) setDetailLeadId(null);
          }}
          lead={detailLead}
          onEdit={() => {
            setDetailLeadId(null);
            setEditLead(detailLead);
          }}
        />
      )}

      {/* Archive confirmation */}
      <AlertDialog
        open={!!archiveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null);
            setArchiveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Archive &ldquo;{archiveTarget?.full_name ?? archiveTarget?.email}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This lead will be hidden from the default view. You can still find
              archived leads using the &ldquo;Show archived&rdquo; toggle.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {archiveError && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {archiveError}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              onClick={handleArchive}
              disabled={isPending}
              variant="destructive"
            >
              {isPending ? "Archiving..." : "Archive lead"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
