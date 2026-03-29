"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cancelReferral } from "./actions";

interface Referral {
  id: string;
  referred_email: string;
  status: string;
  referrer_rewarded: boolean;
  referrer_reward_type: string | null;
  completed_at: string | null;
  created_at: string;
  referrer_name: string | null;
  referred_name: string | null;
}

interface ReferralsTableProps {
  referrals: Referral[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  expired: "secondary",
  cancelled: "destructive",
};

export function ReferralsTable({ referrals }: ReferralsTableProps) {
  const [isPending, startTransition] = useTransition();

  function handleCancel(id: string) {
    startTransition(async () => {
      await cancelReferral(id);
    });
  }

  if (referrals.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No referrals yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Referrer</TableHead>
          <TableHead>Referred Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reward</TableHead>
          <TableHead>Date</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm">
              {r.referrer_name ?? "—"}
            </TableCell>
            <TableCell className="text-sm">{r.referred_email}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.referrer_rewarded
                ? r.referrer_reward_type === "credit"
                  ? "Credits granted"
                  : r.referrer_reward_type === "discount"
                    ? "Discount applied"
                    : "—"
                : r.status === "completed"
                  ? "Pending"
                  : "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(r.completed_at ?? r.created_at).toLocaleDateString()}
            </TableCell>
            <TableCell>
              {r.status === "pending" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCancel(r.id)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
