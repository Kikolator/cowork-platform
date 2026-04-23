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
