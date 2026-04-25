import "server-only";

import { createLogger } from "@cowork/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendTenantEmail,
  sendPlatformEmail,
  buildTenantBranding,
} from "@/lib/email";
import BookingConfirmationEmail from "@/emails/tenant/booking-confirmation";
import SpaceSignupEmail from "@/emails/tenant/space-signup";
import PassConfirmationEmail from "@/emails/tenant/pass-confirmation";
import NewPassPurchaseEmail from "@/emails/tenant/new-pass-purchase";
import NewSpaceEmail from "@/emails/platform/new-space";

const PLATFORM_DOMAIN =
  process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";

const logger = createLogger({ component: "email/notifications" });

/* ── Internal helpers ──────────────────────────────────────────── */

async function getSpaceBranding(spaceId: string) {
  const admin = createAdminClient();
  const { data: space } = await admin
    .from("spaces")
    .select(
      "name, logo_url, primary_color, accent_color, address, city, slug, custom_domain",
    )
    .eq("id", spaceId)
    .single();

  if (!space) return null;
  return buildTenantBranding(space, PLATFORM_DOMAIN);
}

async function getUserProfile(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("shared_profiles")
    .select("email, full_name")
    .eq("id", userId)
    .single();
  return data;
}

/* ── Booking confirmation ──────────────────────────────────────── */

export async function notifyBookingConfirmation(params: {
  spaceId: string;
  userId: string;
  resourceName: string;
  date: string;
  startTime: string;
  endTime: string;
}) {
  try {
    const [branding, user] = await Promise.all([
      getSpaceBranding(params.spaceId),
      getUserProfile(params.userId),
    ]);

    if (!branding || !user?.email) return;

    await sendTenantEmail({
      to: user.email,
      subject: `Booking confirmed: ${params.resourceName}`,
      spaceName: branding.name,
      spaceId: params.spaceId,
      userId: params.userId,
      template: "booking-confirmation",
      react: BookingConfirmationEmail({
        tenant: branding,
        memberName: user.full_name ?? "there",
        resourceName: params.resourceName,
        date: params.date,
        startTime: params.startTime,
        endTime: params.endTime,
        bookingUrl: `${branding.spaceUrl}/bookings`,
      }),
    });
  } catch (err) {
    logger.error("Failed to send booking confirmation email", {
      spaceId: params.spaceId,
      userId: params.userId,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}

/* ── Welcome / space signup ────────────────────────────────────── */

export async function notifySpaceSignup(params: {
  spaceId: string;
  userId: string;
  email: string;
  name?: string;
}) {
  try {
    const branding = await getSpaceBranding(params.spaceId);
    if (!branding) return;

    await sendTenantEmail({
      to: params.email,
      subject: `Welcome to ${branding.name}`,
      spaceName: branding.name,
      spaceId: params.spaceId,
      userId: params.userId,
      template: "space-signup",
      react: SpaceSignupEmail({
        tenant: branding,
        memberName: params.name ?? "there",
        dashboardUrl: `${branding.spaceUrl}/dashboard`,
      }),
    });
  } catch (err) {
    logger.error("Failed to send space signup email", {
      spaceId: params.spaceId,
      userId: params.userId,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}

/* ── Pass confirmation (access instructions) ─────────────────── */

export async function notifyPassConfirmation(params: {
  spaceId: string;
  userId: string;
  email: string;
  name?: string;
  passType: "day" | "week";
  startDate: string;
  endDate: string;
  deskName: string | null;
  /** Magic link URL for guest checkout — signs user in on click. */
  magicLinkUrl?: string;
}) {
  try {
    const admin = createAdminClient();
    const branding = await getSpaceBranding(params.spaceId);
    if (!branding) return;

    // Fetch access config (door code + WiFi) — admin-only RLS table
    // WiFi columns not yet in generated types, use select("*")
    const { data: accessConfig } = await admin
      .from("space_access_config")
      .select("*")
      .eq("space_id", params.spaceId)
      .maybeSingle();

    const accessRow = accessConfig as Record<string, unknown> | null;
    const doorCode =
      accessConfig?.enabled ? accessConfig.code_business_hours : null;
    const wifiNetwork = (accessRow?.wifi_network as string | null) ?? null;
    const wifiPassword = (accessRow?.wifi_password as string | null) ?? null;

    // Fetch community rules (column not yet in generated types)
    const { data: space } = await admin
      .from("spaces")
      .select("*")
      .eq("id", params.spaceId)
      .single();
    const communityRulesText = ((space as Record<string, unknown> | null)
      ?.community_rules_text as string | null) ?? null;

    // Truncate rules to ~500 chars for the email
    const communityRulesSummary = communityRulesText
      ? communityRulesText.length > 500
        ? communityRulesText.slice(0, 497) + "..."
        : communityRulesText
      : null;

    const passLabel = params.passType === "week" ? "Week Pass" : "Day Pass";

    // Format dates for display
    const formatDate = (dateStr: string) => {
      const d = new Date(dateStr + "T12:00:00Z");
      return d.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    };

    await sendTenantEmail({
      to: params.email,
      subject: params.magicLinkUrl
        ? `Welcome to ${branding.name} \u2014 ${passLabel} confirmed`
        : `${passLabel} confirmed \u2014 ${formatDate(params.startDate)}`,
      spaceName: branding.name,
      spaceId: params.spaceId,
      userId: params.userId,
      template: "pass-confirmation",
      react: PassConfirmationEmail({
        tenant: branding,
        memberName: params.name ?? "there",
        passType: passLabel,
        startDate: formatDate(params.startDate),
        endDate: formatDate(params.endDate),
        deskName: params.deskName,
        doorCode,
        wifiNetwork,
        wifiPassword,
        communityRulesSummary,
        dashboardUrl: `${branding.spaceUrl}/dashboard`,
        magicLinkUrl: params.magicLinkUrl,
      }),
    });
  } catch (err) {
    logger.error("Failed to send pass confirmation email", {
      spaceId: params.spaceId,
      userId: params.userId,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}

/* ── Admin notification: new pass purchase ────────────────────── */

export async function notifyNewPassPurchase(params: {
  spaceId: string;
  visitorName: string | null;
  visitorEmail: string;
  passType: "day" | "week";
  startDate: string;
  endDate: string;
  amountCents: number;
  currency: string;
}) {
  try {
    const branding = await getSpaceBranding(params.spaceId);
    if (!branding) return;

    const admin = createAdminClient();
    const { data: spaceUser } = await admin
      .from("space_users")
      .select("user_id")
      .eq("space_id", params.spaceId)
      .eq("role", "owner")
      .single();

    if (!spaceUser) return;

    const owner = await getUserProfile(spaceUser.user_id);
    if (!owner?.email) return;

    const fmt = (iso: string) =>
      new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      });

    const amountFormatted = new Intl.NumberFormat("en", {
      style: "currency",
      currency: params.currency,
    }).format(params.amountCents / 100);

    const passLabel = params.passType === "week" ? "Week Pass" : "Day Pass";
    const displayName = params.visitorName || params.visitorEmail;

    await sendTenantEmail({
      to: owner.email,
      subject: `New pass purchase \u2014 ${displayName}`,
      spaceName: branding.name,
      spaceId: params.spaceId,
      userId: spaceUser.user_id,
      template: "new-pass-purchase",
      react: NewPassPurchaseEmail({
        tenant: branding,
        visitorName: params.visitorName ?? "",
        visitorEmail: params.visitorEmail,
        passType: passLabel,
        startDate: fmt(params.startDate),
        endDate: fmt(params.endDate),
        amountFormatted,
        dashboardUrl: `${branding.spaceUrl}/admin/passes`,
      }),
    });
  } catch (err) {
    logger.error("Failed to send new pass purchase email", {
      spaceId: params.spaceId,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}

/* ── New space created (platform email to owner) ───────────────── */

export async function notifyNewSpace(params: {
  spaceName: string;
  ownerEmail: string;
  ownerName: string;
  spaceSlug: string;
}) {
  try {
    const proto = PLATFORM_DOMAIN.startsWith("localhost") ? "http" : "https";
    const dashboardUrl = `${proto}://${params.spaceSlug}.${PLATFORM_DOMAIN}/dashboard`;

    await sendPlatformEmail({
      to: params.ownerEmail,
      subject: `Your space "${params.spaceName}" is ready`,
      template: "new-space",
      react: NewSpaceEmail({
        spaceName: params.spaceName,
        ownerName: params.ownerName,
        dashboardUrl,
      }),
    });
  } catch (err) {
    logger.error("Failed to send new space email", {
      spaceSlug: params.spaceSlug,
      error: err instanceof Error ? err.message : "Unknown",
    });
  }
}
