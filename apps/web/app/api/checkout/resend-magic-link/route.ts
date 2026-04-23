import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { sendTenantEmail, buildTenantBranding } from "@/lib/email";
import MagicLinkEmail from "@/emails/tenant/magic-link";
import { resendMagicLinkSchema } from "../schemas";

// Simple in-memory rate limit: email → last sent timestamp
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_MS = 60_000;

export async function POST(request: NextRequest) {
  const spaceId = request.headers.get("x-space-id");
  if (!spaceId) {
    return NextResponse.json({ error: "Space not resolved" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = resendMagicLinkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { session_id } = parsed.data;
  const admin = createAdminClient();

  // Resolve connected account
  const { data: space } = await admin
    .from("spaces")
    .select("tenant_id")
    .eq("id", spaceId)
    .single();

  if (!space) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("stripe_account_id")
    .eq("id", space.tenant_id)
    .single();

  if (!tenant?.stripe_account_id) {
    return NextResponse.json(
      { error: "Payment not configured" },
      { status: 400 },
    );
  }

  // Retrieve session to get email
  let email: string | null = null;
  try {
    const session = await getStripe().checkout.sessions.retrieve(session_id, {
      stripeAccount: tenant.stripe_account_id,
    });
    email = session.customer_email ?? session.customer_details?.email ?? null;
  } catch {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 },
    );
  }

  if (!email) {
    return NextResponse.json(
      { error: "No email associated with this session" },
      { status: 400 },
    );
  }

  // Rate limit check
  const lastSent = rateLimitMap.get(email);
  if (lastSent && Date.now() - lastSent < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Please wait before requesting another link" },
      { status: 429 },
    );
  }

  // Resolve space branding + origin for redirect
  const { data: spaceData } = await admin
    .from("spaces")
    .select(
      "name, logo_url, primary_color, accent_color, address, city, slug, custom_domain",
    )
    .eq("id", spaceId)
    .single();

  if (!spaceData) {
    return NextResponse.json({ error: "Space not found" }, { status: 404 });
  }

  const platformDomain =
    process.env.NEXT_PUBLIC_PLATFORM_DOMAIN ?? "localhost:3000";
  const proto = platformDomain.startsWith("localhost") ? "http" : "https";
  const spaceOrigin = spaceData.custom_domain
    ? `${proto}://${spaceData.custom_domain}`
    : `${proto}://${spaceData.slug ?? "app"}.${platformDomain}`;

  // Generate magic link (returns the URL — does NOT send email)
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: `${spaceOrigin}/auth/callback` },
    });

  if (linkError || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: "Failed to generate magic link" },
      { status: 500 },
    );
  }

  // Send branded magic link email via Resend
  const branding = buildTenantBranding(spaceData, platformDomain);

  try {
    await sendTenantEmail({
      to: email,
      subject: `Sign in to ${branding.name}`,
      spaceName: branding.name,
      spaceId,
      template: "magic-link",
      react: MagicLinkEmail({
        tenant: branding,
        actionUrl: linkData.properties.action_link,
      }),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send magic link email" },
      { status: 500 },
    );
  }

  rateLimitMap.set(email, Date.now());
  return NextResponse.json({ sent: true });
}
