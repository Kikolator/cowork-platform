"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { upsertReferralProgram } from "./actions";

interface ResourceType {
  id: string;
  name: string;
}

interface ProgramFormProps {
  program: {
    active: boolean;
    referrer_reward_type: string;
    referrer_credit_minutes: number | null;
    referrer_credit_resource_type_id: string | null;
    referrer_discount_percent: number | null;
    referrer_discount_months: number | null;
    referred_discount_percent: number;
    referred_discount_months: number;
    max_referrals_per_member: number | null;
    max_referrals_total: number | null;
    code_expiry_days: number | null;
  } | null;
  resourceTypes: ResourceType[];
}

export function ProgramForm({ program, resourceTypes }: ProgramFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [active, setActive] = useState(program?.active ?? true);
  const [rewardType, setRewardType] = useState(program?.referrer_reward_type ?? "credit");
  const [creditMinutes, setCreditMinutes] = useState(program?.referrer_credit_minutes?.toString() ?? "60");
  const [creditResourceTypeId, setCreditResourceTypeId] = useState(program?.referrer_credit_resource_type_id ?? "");
  const [discountPercent, setDiscountPercent] = useState(program?.referrer_discount_percent?.toString() ?? "10");
  const [discountMonths, setDiscountMonths] = useState(program?.referrer_discount_months?.toString() ?? "1");
  const [referredPercent, setReferredPercent] = useState(program?.referred_discount_percent?.toString() ?? "10");
  const [referredMonths, setReferredMonths] = useState(program?.referred_discount_months?.toString() ?? "1");
  const [maxPerMember, setMaxPerMember] = useState(program?.max_referrals_per_member?.toString() ?? "");
  const [maxTotal, setMaxTotal] = useState(program?.max_referrals_total?.toString() ?? "");
  const [codeExpiryDays, setCodeExpiryDays] = useState(program?.code_expiry_days?.toString() ?? "90");

  function handleSubmit() {
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      const result = await upsertReferralProgram({
        active,
        referrerRewardType: rewardType,
        referrerCreditMinutes: rewardType === "credit" ? Number(creditMinutes) : null,
        referrerCreditResourceTypeId: rewardType === "credit" ? (creditResourceTypeId || null) : null,
        referrerDiscountPercent: rewardType === "discount" ? Number(discountPercent) : null,
        referrerDiscountMonths: rewardType === "discount" ? Number(discountMonths) : null,
        referredDiscountPercent: Number(referredPercent),
        referredDiscountMonths: Number(referredMonths),
        maxReferralsPerMember: maxPerMember ? Number(maxPerMember) : null,
        maxReferralsTotal: maxTotal ? Number(maxTotal) : null,
        codeExpiryDays: codeExpiryDays ? Number(codeExpiryDays) : null,
      });

      if (result.success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-500">
          Program saved successfully
        </p>
      )}

      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <Label className="text-sm font-medium">Program Active</Label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Members can generate and share referral codes
          </p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium">Referred Member Benefit</h3>
        <p className="text-xs text-muted-foreground">
          Discount applied to the new member&apos;s subscription
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Discount %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              value={referredPercent}
              onChange={(e) => setReferredPercent(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Duration (months)</Label>
            <Input
              type="number"
              min={1}
              max={12}
              value={referredMonths}
              onChange={(e) => setReferredMonths(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium">Referrer Reward</h3>
        <p className="text-xs text-muted-foreground">
          Reward for the member who referred someone
        </p>
        <div>
          <Label className="text-xs">Reward Type</Label>
          <Select value={rewardType} onValueChange={setRewardType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">Credit Minutes</SelectItem>
              <SelectItem value="discount">Subscription Discount</SelectItem>
              <SelectItem value="none">No Reward</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {rewardType === "credit" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Minutes to Grant</Label>
              <Input
                type="number"
                min={1}
                value={creditMinutes}
                onChange={(e) => setCreditMinutes(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Resource Type</Label>
              <Select value={creditResourceTypeId} onValueChange={setCreditResourceTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select resource type" />
                </SelectTrigger>
                <SelectContent>
                  {resourceTypes.map((rt) => (
                    <SelectItem key={rt.id} value={rt.id}>
                      {rt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {rewardType === "discount" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Discount %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Duration (months)</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={discountMonths}
                onChange={(e) => setDiscountMonths(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-xl border border-border p-4">
        <h3 className="text-sm font-medium">Limits</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label className="text-xs">Max per Member</Label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxPerMember}
              onChange={(e) => setMaxPerMember(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Max Total</Label>
            <Input
              type="number"
              min={1}
              placeholder="Unlimited"
              value={maxTotal}
              onChange={(e) => setMaxTotal(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Code Expiry (days)</Label>
            <Input
              type="number"
              min={1}
              placeholder="Never"
              value={codeExpiryDays}
              onChange={(e) => setCodeExpiryDays(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button onClick={handleSubmit} disabled={isPending} className="w-full">
        {isPending ? "Saving..." : program ? "Update Program" : "Create Program"}
      </Button>
    </div>
  );
}
