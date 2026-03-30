import { headers } from "next/headers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildSpaceUrlFromHeaders } from "@/lib/url";
import { getReferralData } from "./actions";
import { ShareCard } from "./share-card";
import { ReferralHistory } from "./referral-history";

export default async function ReferralsPage() {
  const data = await getReferralData();

  if (!data.enabled) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              The referral program is not currently active.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const h = await headers();
  const shareUrl = buildSpaceUrlFromHeaders(
    data.spaceSlug,
    `/plan?ref=${data.code}`,
    h,
  );

  const rewardDescription =
    data.program.referrerRewardType === "credit"
      ? `${data.program.referrerCreditMinutes} minutes of credits`
      : data.program.referrerRewardType === "discount"
        ? `${data.program.referrerDiscountPercent}% off for ${data.program.referrerDiscountMonths} month(s)`
        : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Referrals</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite friends to join and{" "}
          {rewardDescription
            ? `earn ${rewardDescription} for each successful referral`
            : "help grow the community"}
          .
        </p>
      </div>

      <ShareCard
        code={data.code}
        shareUrl={shareUrl}
        expiresAt={data.expiresAt}
        referredDiscountPercent={data.program.referredDiscountPercent}
        referredDiscountMonths={data.program.referredDiscountMonths}
      />

      <Card>
        <CardHeader>
          <CardTitle>Your Referrals</CardTitle>
        </CardHeader>
        <CardContent>
          <ReferralHistory
            referrals={data.referrals}
            referrerRewardType={data.program.referrerRewardType}
            referrerCreditMinutes={data.program.referrerCreditMinutes}
            referrerDiscountPercent={data.program.referrerDiscountPercent}
          />
        </CardContent>
      </Card>
    </div>
  );
}
