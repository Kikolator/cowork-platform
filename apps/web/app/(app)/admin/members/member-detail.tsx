"use client";

import { Pencil, Shield, Clock, Building2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MemberNoteForm } from "./member-note-form";
import type { Member, MemberNote, ProfileEntry } from "./members-table";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  paused: {
    label: "Paused",
    className: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  past_due: {
    label: "Past Due",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  cancelling: {
    label: "Cancelling",
    className: "bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  },
  churned: {
    label: "Churned",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

const NOTE_CATEGORY_CONFIG: Record<string, { label: string; className: string }> = {
  general: {
    label: "General",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  billing: {
    label: "Billing",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  access: {
    label: "Access",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  incident: {
    label: "Incident",
    className: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
  support: {
    label: "Support",
    className: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  },
};

interface MemberDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Member;
  profile: ProfileEntry;
  planName: string;
  deskName: string | null;
  notes: MemberNote[];
  profileMap: Record<string, ProfileEntry>;
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

export function MemberDetail({
  open,
  onOpenChange,
  member,
  profile,
  planName,
  deskName,
  notes,
  profileMap,
  onEdit,
}: MemberDetailProps) {
  const statusCfg = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.active!;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle>
                {profile.full_name ?? profile.email}
              </DialogTitle>
              {profile.full_name && (
                <p className="mt-0.5 text-sm text-muted-foreground">{profile.email}</p>
              )}
              {profile.phone && (
                <p className="text-sm text-muted-foreground">{profile.phone}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
          </div>
        </DialogHeader>

        {/* Membership */}
        <Separator />
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3.5 w-3.5" />
            Membership
          </h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            <DetailRow label="Plan" value={planName} />
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
            <DetailRow label="Joined" value={formatDate(member.joined_at)} />
            <DetailRow
              label="Last login"
              value={
                profile.last_login_at
                  ? formatRelativeTime(profile.last_login_at)
                  : <span className="text-muted-foreground">Never</span>
              }
            />
            {member.invited_at && (
              <DetailRow
                label="Invite sent"
                value={formatRelativeTime(member.invited_at)}
              />
            )}
            {member.paused_at && (
              <DetailRow label="Paused" value={formatDate(member.paused_at)} />
            )}
            {member.cancel_requested_at && (
              <DetailRow label="Cancel requested" value={formatDate(member.cancel_requested_at)} />
            )}
            {member.cancelled_at && (
              <DetailRow label="Cancelled" value={formatDate(member.cancelled_at)} />
            )}
          </dl>
        </div>

        {/* Access */}
        <Separator />
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Access
          </h4>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
            <DetailRow label="Fixed desk" value={deskName} />
            <DetailRow label="24/7 access" value={member.has_twenty_four_seven ? "Yes" : "No"} />
            <DetailRow label="Access code" value={member.access_code} />
            <DetailRow label="Alarm approved" value={member.alarm_approved ? "Yes" : "No"} />
          </dl>
        </div>

        {/* Professional (only if populated) */}
        {(member.company || member.role_title) && (
          <>
            <Separator />
            <div className="space-y-2">
              <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" />
                Professional
              </h4>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                {member.company && <DetailRow label="Company" value={member.company} />}
                {member.role_title && <DetailRow label="Role" value={member.role_title} />}
              </dl>
            </div>
          </>
        )}

        {/* Notes */}
        <Separator />
        <div className="space-y-3">
          <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            Notes
          </h4>
          <MemberNoteForm memberId={member.id} />
          {notes.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              No notes yet
            </p>
          ) : (
            <div className="space-y-3">
              {notes.map((note) => {
                const catCfg =
                  NOTE_CATEGORY_CONFIG[note.category] ?? NOTE_CATEGORY_CONFIG.general!;
                const author = profileMap[note.author_id];

                return (
                  <div
                    key={note.id}
                    className="rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={`border-transparent text-[10px] leading-none px-1.5 py-0.5 ${catCfg.className}`}
                      >
                        {catCfg.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {author?.full_name ?? author?.email ?? "Unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(note.created_at)}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm whitespace-pre-wrap">
                      {note.content}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
