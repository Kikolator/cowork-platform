import "server-only";
import { resend } from "./resend";
import { createClient } from "./supabase/server";
import type { TenantBranding } from "../emails/components/tenant-layout";

const PLATFORM_FROM = "Cowork Platform <noreply@rogueops.app>";

interface SendEmailOptions {
  to: string;
  subject: string;
  react: React.ReactElement;
  /** Space ID for notifications_log. If omitted, email is not logged. */
  spaceId?: string;
  /** User ID for notifications_log */
  userId?: string;
  /** Template name for notifications_log */
  template?: string;
  /** Idempotency key to prevent duplicate sends */
  idempotencyKey?: string;
}

/** Send a platform-branded email (from the platform, not a tenant). */
export async function sendPlatformEmail(options: SendEmailOptions) {
  return sendEmail({ ...options, from: PLATFORM_FROM });
}

/** Send a tenant-branded email (from a specific space). */
export async function sendTenantEmail(
  options: SendEmailOptions & { spaceName: string }
) {
  const from = `${options.spaceName} <noreply@rogueops.app>`;
  return sendEmail({ ...options, from });
}

async function sendEmail(options: SendEmailOptions & { from: string }) {
  const { to, subject, react, from, spaceId, userId, template, idempotencyKey } =
    options;

  const { data, error } = await resend.emails.send(
    { from, to, subject, react },
    idempotencyKey
      ? { headers: { "Idempotency-Key": idempotencyKey } }
      : undefined
  );

  // Log to notifications_log if space context provided
  if (spaceId && template) {
    const supabase = await createClient();
    await supabase.from("notifications_log").insert({
      space_id: spaceId,
      user_id: userId ?? null,
      channel: "email",
      template,
      recipient: to,
      subject,
      metadata: { resend_id: data?.id ?? null },
      error: error?.message ?? null,
    });
  }

  if (error) {
    throw new Error(`Email send failed: ${error.message}`);
  }

  return data;
}

/** Build TenantBranding from a space record. */
export function buildTenantBranding(
  space: {
    name: string;
    logo_url: string | null;
    primary_color: string | null;
    address: string | null;
    city: string | null;
    slug: string;
    custom_domain: string | null;
  },
  platformDomain: string
): TenantBranding {
  const spaceUrl = space.custom_domain
    ? `https://${space.custom_domain}`
    : `https://${space.slug}.${platformDomain}`;

  return {
    name: space.name,
    logoUrl: space.logo_url,
    primaryColor: space.primary_color ?? "#000000",
    address: space.address,
    city: space.city,
    spaceUrl,
  };
}
