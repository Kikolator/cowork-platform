"use client";

import { useState, useTransition } from "react";
import {
  Pencil,
  Mail,
  CalendarDays,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateAdminNotes } from "./actions";
import type { Lead } from "./leads-table";

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

interface LeadDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead;
  onEdit: () => void;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || <span className="text-muted-foreground">-</span>}</dd>
    </div>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function LeadDetail({ open, onOpenChange, lead, onEdit }: LeadDetailProps) {
  const statusCfg = STATUS_CONFIG[lead.status] ?? STATUS_CONFIG.new!;
  const [notes, setNotes] = useState(lead.admin_notes ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSaveNotes() {
    startTransition(async () => {
      await updateAdminNotes(lead.id, notes);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>
                {lead.full_name ?? lead.email}
              </DialogTitle>
              {lead.full_name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{lead.email}</p>
              )}
              {lead.phone && (
                <p className="text-sm text-muted-foreground">{lead.phone}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        {/* Contact Info */}
        <Separator />
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Mail className="h-3.5 w-3.5" />
            Contact Info
          </h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <DetailRow label="Email" value={lead.email} />
            <DetailRow label="Phone" value={lead.phone} />
            <DetailRow label="Company" value={lead.company} />
            <DetailRow
              label="Source"
              value={SOURCE_LABELS[lead.source ?? ""] ?? lead.source}
            />
          </dl>
        </div>

        {/* Pipeline */}
        <Separator />
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CalendarDays className="h-3.5 w-3.5" />
            Pipeline
          </h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <DetailRow
              label="Status"
              value={
                <Badge
                  variant="outline"
                  className={`border-transparent ${statusCfg.className}`}
                >
                  {statusCfg.label}
                </Badge>
              }
            />
            <DetailRow label="Trial Date" value={formatDate(lead.trial_date)} />
            <DetailRow
              label="Trial Confirmed"
              value={lead.trial_confirmed ? "Yes" : "No"}
            />
            <DetailRow
              label="Follow-up Count"
              value={String(lead.follow_up_count ?? 0)}
            />
            <DetailRow
              label="Last Contacted"
              value={
                lead.last_contacted_at
                  ? formatRelativeTime(lead.last_contacted_at)
                  : null
              }
            />
            <DetailRow label="Created" value={formatDate(lead.created_at)} />
          </dl>
        </div>

        {/* Admin Notes */}
        <Separator />
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Admin Notes
          </h4>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add internal notes about this lead..."
            rows={4}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={isPending || notes === (lead.admin_notes ?? "")}
            >
              {isPending ? "Saving..." : "Save Notes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
