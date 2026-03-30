"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Referral {
  id: string;
  referred_email: string;
  status: string;
  referrer_rewarded: boolean;
  referrer_reward_type: string | null;
  completed_at: string | null;
  created_at: string;
}

interface ReferralHistoryProps {
  referrals: Referral[];
  referrerRewardType: string;
  referrerCreditMinutes: number | null;
  referrerDiscountPercent: number | null;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  completed: "default",
  expired: "secondary",
  cancelled: "destructive",
};

export function ReferralHistory({
  referrals,
  referrerRewardType,
  referrerCreditMinutes,
  referrerDiscountPercent,
}: ReferralHistoryProps) {
  if (referrals.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No referrals yet. Share your code to get started!
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Reward</TableHead>
          <TableHead>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {referrals.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="text-sm">{r.referred_email}</TableCell>
            <TableCell>
              <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                {r.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {r.referrer_rewarded
                ? referrerRewardType === "credit"
                  ? `+${referrerCreditMinutes} min`
                  : referrerRewardType === "discount"
                    ? `${referrerDiscountPercent}% off`
                    : "—"
                : r.status === "pending"
                  ? "Awaiting signup"
                  : "—"}
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">
              {new Date(r.completed_at ?? r.created_at).toLocaleDateString()}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
