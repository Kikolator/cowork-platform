/**
 * Supabase send_email hook — intercepts all auth emails, resolves
 * tenant branding from the redirect URL, and sends branded HTML
 * via Resend.
 *
 * Required secrets (set via `supabase secrets set`):
 *   RESEND_API_KEY          — Resend API key
 *   SEND_EMAIL_HOOK_SECRET  — Webhook signing secret (base64, no v1,whsec_ prefix)
 *
 * Auto-injected by Supabase:
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional:
 *   PLATFORM_DOMAIN — e.g. "rogueops.app" (defaults to "rogueops.app")
 */

import { createClient } from "jsr:@supabase/supabase-js@2";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";

/* ── Types ─────────────────────────────────────────────────────── */

interface EmailHookPayload {
  user: { email: string };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
    token_new: string;
    token_hash_new: string;
  };
}

interface SpaceBranding {
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  address: string | null;
  city: string | null;
  slug: string;
  custom_domain: string | null;
}

/* ── Design tokens (match apps/web/emails/components/styles.ts) ─ */

const C = {
  bg: "#f4f4f5",
  card: "#ffffff",
  border: "#e4e4e7",
  heading: "#18181b",
  body: "#3f3f46",
  muted: "#71717a",
  faint: "#a1a1aa",
  brand: "#18181b",
} as const;

const FONT =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const PLATFORM_NAME = "RogueOps";
const PLATFORM_URL = "https://rogueops.app";
const PLATFORM_LOGO = `${PLATFORM_URL}/logo.png`;

/* ── Handler ───────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");
  const resendApiKey = Deno.env.get("RESEND_API_KEY");

  if (!hookSecret || !resendApiKey) {
    console.error("Missing SEND_EMAIL_HOOK_SECRET or RESEND_API_KEY");
    return jsonError("Server misconfigured", 500);
  }

  // 1. Verify webhook signature
  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);
  const wh = new Webhook(hookSecret);

  let data: EmailHookPayload;
  try {
    data = wh.verify(payload, headers) as EmailHookPayload;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return jsonError("Invalid signature", 401);
  }

  const { user, email_data } = data;
  const { token_hash, redirect_to, email_action_type } = email_data;

  // 2. Resolve space branding from redirect URL
  const space = await resolveSpaceFromRedirect(redirect_to);

  // 3. Build action URL (the link the user clicks)
  const actionUrl = `${redirect_to}?token_hash=${encodeURIComponent(token_hash)}&type=${encodeURIComponent(email_action_type)}`;

  // 4. Build email content
  const { subject, html, from } = space
    ? buildTenantAuthEmail(space, actionUrl, email_action_type)
    : buildPlatformAuthEmail(actionUrl, email_action_type);

  // 5. Send via Resend
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [user.email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend ${res.status}: ${body}`);
    }
  } catch (err) {
    console.error("Email send failed:", err);
    return jsonError(err instanceof Error ? err.message : "Send failed", 500);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

/* ── Space resolution ──────────────────────────────────────────── */

async function resolveSpaceFromRedirect(
  redirectTo: string,
): Promise<SpaceBranding | null> {
  try {
    const url = new URL(redirectTo);
    const hostname = url.hostname;
    const platformDomain =
      Deno.env.get("PLATFORM_DOMAIN") ?? "rogueops.app";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const fields =
      "name, logo_url, primary_color, accent_color, address, city, slug, custom_domain";

    // Subdomain match (e.g. urbanhive.rogueops.app)
    if (hostname.endsWith(`.${platformDomain}`)) {
      const slug = hostname.replace(`.${platformDomain}`, "");
      const { data } = await supabase
        .from("spaces")
        .select(fields)
        .eq("slug", slug)
        .single();
      return data;
    }

    // Custom domain match
    if (hostname !== platformDomain && hostname !== "localhost") {
      const { data } = await supabase
        .from("spaces")
        .select(fields)
        .eq("custom_domain", hostname)
        .single();
      return data;
    }

    return null;
  } catch {
    return null;
  }
}

/* ── Email builders ────────────────────────────────────────────── */

function emailContent(
  type: string,
  spaceName: string,
): { subject: string; heading: string; body: string; cta: string; hint: string } {
  switch (type) {
    case "invite":
      return {
        subject: `You've been invited to ${spaceName}`,
        heading: `You've been invited to ${spaceName}`,
        body: `You've been invited to join <strong>${esc(spaceName)}</strong> as a member. Click below to accept and set up your account.`,
        cta: "Accept Invite",
        hint: "If you weren't expecting this invite, you can safely ignore this email.",
      };
    case "magiclink":
    default:
      return {
        subject: `Sign in to ${spaceName}`,
        heading: `Sign in to ${spaceName}`,
        body: "Click the button below to securely sign in. This link expires in 1 hour.",
        cta: "Sign In",
        hint: "If you didn't request this, you can safely ignore this email.",
      };
  }
}

function buildTenantAuthEmail(
  space: SpaceBranding,
  actionUrl: string,
  type: string,
): { subject: string; html: string; from: string } {
  const brandColor = space.primary_color ?? "#000000";
  const content = emailContent(type, space.name);
  const spaceUrl = space.custom_domain
    ? `https://${space.custom_domain}`
    : `https://${space.slug}.${Deno.env.get("PLATFORM_DOMAIN") ?? "rogueops.app"}`;

  const logoHtml = space.logo_url
    ? `<img src="${esc(space.logo_url)}" width="140" height="40" alt="${esc(space.name)}" style="display:block;border:0;object-fit:contain;margin:0 auto;" />`
    : `<p style="font-size:22px;font-weight:700;color:${esc(brandColor)};margin:0;text-align:center;">${esc(space.name)}</p>`;

  const addressParts = [space.address, space.city].filter(Boolean);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${esc(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Space logo / name -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              ${logoHtml}
            </td>
          </tr>
          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background-color:${esc(brandColor)};border-radius:8px 8px 0 0;"></td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${C.card};border-radius:0 0 8px 8px;padding:32px 24px;border:1px solid ${C.border};border-top:none;">
              <h1 style="font-size:22px;font-weight:600;color:${C.heading};line-height:1.3;margin:0 0 8px;">${esc(content.heading)}</h1>
              <p style="font-size:15px;line-height:1.6;color:${C.body};margin:0 0 16px;">${content.body}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="border-radius:6px;background-color:${esc(brandColor)};">
                    <a href="${esc(actionUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(content.cta)}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;line-height:1.5;color:${C.muted};margin:16px 0 0;">${esc(content.hint)}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center">
                  <p style="font-size:13px;font-weight:600;color:${C.body};margin:0 0 4px;">${esc(space.name)}</p>
                  ${addressParts.length > 0 ? `<p style="font-size:12px;color:${C.muted};margin:0 0 4px;">${esc(addressParts.join(", "))}</p>` : ""}
                  <p style="font-size:12px;color:${C.muted};margin:0 0 12px;"><a href="${esc(spaceUrl)}" style="color:${C.muted};text-decoration:underline;">${esc(spaceUrl.replace(/^https?:\/\//, ""))}</a></p>
                  <p style="font-size:11px;color:${C.faint};margin:0;">Powered by <a href="${PLATFORM_URL}" style="color:${C.faint};text-decoration:underline;">${PLATFORM_NAME}</a></p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: content.subject,
    html,
    from: `${space.name} <noreply@rogueops.app>`,
  };
}

function buildPlatformAuthEmail(
  actionUrl: string,
  type: string,
): { subject: string; html: string; from: string } {
  const content = emailContent(type, PLATFORM_NAME);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <title>${esc(content.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.bg};">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
          <!-- Platform logo -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <img src="${PLATFORM_LOGO}" width="140" height="40" alt="${PLATFORM_NAME}" style="display:block;border:0;" />
            </td>
          </tr>
          <!-- Card -->
          <tr>
            <td style="background-color:${C.card};border-radius:8px;padding:32px 24px;border:1px solid ${C.border};">
              <h1 style="font-size:22px;font-weight:600;color:${C.heading};line-height:1.3;margin:0 0 8px;">${esc(content.heading)}</h1>
              <p style="font-size:15px;line-height:1.6;color:${C.body};margin:0 0 16px;">${content.body}</p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                <tr>
                  <td style="border-radius:6px;background-color:${C.brand};">
                    <a href="${esc(actionUrl)}" target="_blank" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:500;color:#ffffff;text-decoration:none;border-radius:6px;">${esc(content.cta)}</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px;line-height:1.5;color:${C.muted};margin:16px 0 0;">${esc(content.hint)}</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td align="center">
                  <p style="font-size:13px;color:${C.muted};margin:0 0 4px;">Sent by <a href="${PLATFORM_URL}" style="color:${C.heading};text-decoration:underline;">${PLATFORM_NAME}</a></p>
                  <p style="font-size:12px;color:${C.faint};margin:0;">&copy; ${new Date().getFullYear()} ${PLATFORM_NAME}. All rights reserved.</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    subject: content.subject,
    html,
    from: `${PLATFORM_NAME} <noreply@rogueops.app>`,
  };
}

/* ── Utilities ─────────────────────────────────────────────────── */

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function jsonError(message: string, status = 400): Response {
  return new Response(
    JSON.stringify({ error: { http_code: status, message } }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
