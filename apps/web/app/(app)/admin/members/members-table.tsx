"use client";

import { useState, useMemo, useTransition } from "react";
import {
  Search,
  Users,
  MoreHorizontal,
  Pencil,
  Eye,
  Plus,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemberDetail } from "./member-detail";
import { MemberForm, type DeskAssignment } from "./member-form";
import { AddMemberForm } from "./add-member-form";
import { sendMemberInvite, sendBulkInvites } from "./actions";

export interface ProfileEntry {
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
}

export interface Member {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  fixed_desk_id: string | null;
  has_twenty_four_seven: boolean | null;
  access_code: string | null;
  alarm_approved: boolean | null;
  company: string | null;
  role_title: string | null;
  billing_entity_type: string | null;
  fiscal_id_type: string | null;
  fiscal_id: string | null;
  billing_company_name: string | null;
  billing_company_tax_id_type: string | null;
  billing_company_tax_id: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_city: string | null;
  billing_postal_code: string | null;
  billing_state_province: string | null;
  billing_country: string | null;
  joined_at: string | null;
  paused_at: string | null;
  cancel_requested_at: string | null;
  cancelled_at: string | null;
  invited_at: string | null;
  plan: { id: string; name: string } | null;
}

export interface MemberNote {
  id: string;
  member_id: string;
  author_id: string;
  content: string;
  category: string;
  created_at: string;
}

interface MembersTableProps {
  members: Member[];
  plans: { id: string; name: string }[];
  desks: { id: string; name: string }[];
  profileMap: Record<string, ProfileEntry>;
  notes: MemberNote[];
}

const STATUS_OPTIONS = ["active", "paused", "past_due", "cancelling", "churned"] as const;

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

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  paused: "Paused",
  past_due: "Past Due",
  cancelling: "Cancelling",
  churned: "Churned",
};

const LOGIN_STATUS_CONFIG = {
  logged_in: {
    label: "Logged in",
    className: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  },
  invite_sent: {
    label: "Invite sent",
    className: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  not_invited: {
    label: "Not invited",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
} as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(dateStr));
}

function formatRelativeDate(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]![0]!.toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

function getLoginStatus(
  profile: ProfileEntry | undefined,
  member: Member,
): keyof typeof LOGIN_STATUS_CONFIG {
  if (profile?.last_login_at) return "logged_in";
  if (member.invited_at) return "invite_sent";
  return "not_invited";
}

export function MembersTable({
  members,
  plans,
  desks,
  profileMap,
  notes,
}: MembersTableProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [planFilter, setPlanFilter] = useState<string | null>(null);
  const [detailMemberId, setDetailMemberId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  // Map deskId → assigned member info (for conflict detection)
  const deskAssignments = useMemo(() => {
    const map: Record<string, DeskAssignment> = {};
    for (const m of members) {
      if (m.fixed_desk_id) {
        const profile = profileMap[m.user_id];
        map[m.fixed_desk_id] = {
          memberId: m.id,
          memberName: profile?.full_name ?? profile?.email ?? "Unknown",
        };
      }
    }
    return map;
  }, [members, profileMap]);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (planFilter && m.plan_id !== planFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const profile = profileMap[m.user_id];
        const name = profile?.full_name?.toLowerCase() ?? "";
        const email = profile?.email?.toLowerCase() ?? "";
        const company = m.company?.toLowerCase() ?? "";
        if (!name.includes(q) && !email.includes(q) && !company.includes(q)) return false;
      }
      return true;
    });
  }, [members, search, statusFilter, planFilter, profileMap]);

  // Members eligible for invite (not yet logged in)
  const uninvitedFiltered = useMemo(
    () => filtered.filter((m) => !profileMap[m.user_id]?.last_login_at),
    [filtered, profileMap],
  );

  const allUninvitedSelected =
    uninvitedFiltered.length > 0 &&
    uninvitedFiltered.every((m) => selectedIds.has(m.id));

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allUninvitedSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(uninvitedFiltered.map((m) => m.id)));
    }
  }

  function handleSendInvite(memberId: string) {
    setInviteMessage(null);
    startTransition(async () => {
      const result = await sendMemberInvite({ memberId });
      if (result.success) {
        setInviteMessage("Invite sent");
      } else {
        setInviteMessage(result.error);
      }
    });
  }

  function handleBulkInvite() {
    setInviteMessage(null);
    startTransition(async () => {
      const result = await sendBulkInvites({
        memberIds: Array.from(selectedIds),
      });
      if (result.success) {
        setInviteMessage(`${result.sent} invite(s) sent${result.failed ? `, ${result.failed} failed` : ""}`);
        setSelectedIds(new Set());
      } else {
        setInviteMessage(result.error);
      }
    });
  }

  const detailMember = detailMemberId
    ? members.find((m) => m.id === detailMemberId) ?? null
    : null;

  const detailProfile = detailMember ? profileMap[detailMember.user_id] : null;

  const detailNotes = detailMember
    ? notes.filter((n) => n.member_id === detailMember.id)
    : [];

  const detailDeskName = detailMember?.fixed_desk_id
    ? desks.find((d) => d.id === detailMember.fixed_desk_id)?.name ?? null
    : null;

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your space members.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Add Member
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
        <Select
          value={planFilter}
          onValueChange={(v) => setPlanFilter(v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All plans">
              {planFilter
                ? plans.find((p) => p.id === planFilter)?.name ?? "All plans"
                : "All plans"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {planFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPlanFilter(null)}
            className="text-xs text-muted-foreground"
          >
            Clear
          </Button>
        )}
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

      {/* Bulk selection toolbar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <Button
            size="sm"
            onClick={handleBulkInvite}
            disabled={isPending}
          >
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            {isPending ? "Sending..." : "Send invites"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
          {inviteMessage && (
            <span className="text-sm text-muted-foreground">{inviteMessage}</span>
          )}
        </div>
      )}

      {/* Inline invite feedback (when no selection) */}
      {inviteMessage && selectedIds.size === 0 && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">{inviteMessage}</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setInviteMessage(null)}
            className="text-xs"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Table or empty state */}
      {members.length === 0 ? (
        <div className="mt-8 flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-base font-medium">No members yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
            Add your first member or import members from a CSV file.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <Checkbox
                    checked={allUninvitedSelected && uninvitedFiltered.length > 0}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all uninvited members"
                  />
                </TableHead>
                <TableHead className="w-[250px]">Member</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-28">Login</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    No members match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((member) => {
                  const profile = profileMap[member.user_id];
                  const statusCfg = STATUS_CONFIG[member.status] ?? STATUS_CONFIG.active!;
                  const loginStatus = getLoginStatus(profile, member);
                  const loginCfg = LOGIN_STATUS_CONFIG[loginStatus];
                  const canInvite = !profile?.last_login_at;

                  return (
                    <TableRow key={member.id}>
                      <TableCell>
                        {canInvite ? (
                          <Checkbox
                            checked={selectedIds.has(member.id)}
                            onCheckedChange={() => toggleSelect(member.id)}
                            aria-label={`Select ${profile?.full_name ?? profile?.email ?? "member"}`}
                          />
                        ) : (
                          <span className="block h-4 w-4" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar size="sm">
                            {profile?.avatar_url && (
                              <AvatarImage src={profile.avatar_url} alt={profile.full_name ?? profile.email} />
                            )}
                            <AvatarFallback>
                              {getInitials(profile?.full_name ?? null)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <div className="font-medium truncate">
                              {profile?.full_name ?? profile?.email ?? "Unknown"}
                            </div>
                            {profile?.full_name && (
                              <div className="text-xs text-muted-foreground truncate">
                                {profile.email}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {member.plan?.name ?? "Unknown"}
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
                        <div className="flex flex-col gap-0.5">
                          <Badge
                            variant="outline"
                            className={`border-transparent text-xs ${loginCfg.className}`}
                          >
                            {loginCfg.label}
                          </Badge>
                          {loginStatus === "invite_sent" && member.invited_at && (
                            <span className="text-[10px] text-muted-foreground">
                              {formatRelativeDate(member.invited_at)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {formatDate(member.joined_at)}
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
                              onClick={() => setDetailMemberId(member.id)}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setEditMember(member)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit member
                            </DropdownMenuItem>
                            {canInvite && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleSendInvite(member.id)}
                                  disabled={isPending}
                                >
                                  <Mail className="mr-2 h-3.5 w-3.5" />
                                  {member.invited_at ? "Resend invite" : "Send invite"}
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
      <AddMemberForm
        open={createOpen}
        onOpenChange={setCreateOpen}
        plans={plans}
      />

      {/* Detail dialog */}
      {detailMember && detailProfile && (
        <MemberDetail
          open={true}
          onOpenChange={(open) => {
            if (!open) setDetailMemberId(null);
          }}
          member={detailMember}
          profile={detailProfile}
          planName={detailMember.plan?.name ?? "Unknown"}
          deskName={detailDeskName}
          notes={detailNotes}
          profileMap={profileMap}
          onEdit={() => {
            setDetailMemberId(null);
            setEditMember(detailMember);
          }}
        />
      )}

      {/* Edit dialog */}
      {editMember && (
        <MemberForm
          open={true}
          onOpenChange={(open) => {
            if (!open) setEditMember(null);
          }}
          member={editMember}
          plans={plans}
          desks={desks}
          deskAssignments={deskAssignments}
        />
      )}
    </>
  );
}
