/**
 * Shared email design tokens and reusable styles.
 * Single source of truth for PlatformLayout, TenantLayout, and all templates.
 */

/* ── Brand constants ─────────────────────────────────────────── */

export const PLATFORM_NAME = "RogueOps";
export const PLATFORM_URL = "https://rogueops.app";
export const PLATFORM_LOGO_URL = `${PLATFORM_URL}/logo.png`;

/* ── Color palette (zinc-based neutral scale) ────────────────── */

export const colors = {
  bg: "#f4f4f5", // zinc-100
  card: "#ffffff",
  cardMuted: "#fafafa", // zinc-50 — detail boxes
  border: "#e4e4e7", // zinc-200
  heading: "#18181b", // zinc-900
  body: "#3f3f46", // zinc-700
  muted: "#71717a", // zinc-500
  faint: "#a1a1aa", // zinc-400
  brand: "#18181b", // platform CTA color
} as const;

/* ── Font stack ──────────────────────────────────────────────── */

export const fontFamily =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

/* ── Shared layout styles ────────────────────────────────────── */

export const layout = {
  body: {
    backgroundColor: colors.bg,
    fontFamily,
    margin: "0",
    padding: "0",
    WebkitTextSizeAdjust: "100%",
  },
  container: {
    maxWidth: "560px",
    margin: "0 auto",
    padding: "40px 20px",
  },
  header: {
    textAlign: "center" as const,
    paddingBottom: "20px",
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: "8px",
    padding: "32px 24px",
    border: `1px solid ${colors.border}`,
  },
  hr: {
    borderColor: colors.border,
    margin: "24px 0",
  },
  footerCenter: {
    textAlign: "center" as const,
    padding: "0 12px",
  },
} as const;

/* ── Shared typography ───────────────────────────────────────── */

export const text = {
  heading: {
    fontSize: "22px",
    fontWeight: "600" as const,
    color: colors.heading,
    lineHeight: "1.3",
    margin: "0 0 8px",
  },
  body: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: colors.body,
    margin: "0 0 16px",
  },
  small: {
    fontSize: "13px",
    lineHeight: "1.5",
    color: colors.muted,
    margin: "0 0 4px",
  },
  tiny: {
    fontSize: "12px",
    lineHeight: "1.5",
    color: colors.faint,
    margin: "0",
  },
} as const;

/* ── Detail box (booking details, summaries, etc.) ───────────── */

export const detailBox = {
  wrapper: {
    backgroundColor: colors.cardMuted,
    borderRadius: "6px",
    padding: "16px 20px",
    marginBottom: "20px",
    border: `1px solid ${colors.border}`,
  },
  label: {
    fontSize: "12px",
    fontWeight: "500" as const,
    color: colors.muted,
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    margin: "0 0 2px",
  },
  value: {
    fontSize: "15px",
    color: colors.heading,
    margin: "0 0 12px",
  },
} as const;

/* ── CTA button factory ──────────────────────────────────────── */

export function buttonStyle(
  bgColor: string = colors.brand,
): React.CSSProperties {
  return {
    display: "inline-block",
    backgroundColor: bgColor,
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "500",
    padding: "12px 28px",
    borderRadius: "6px",
    textDecoration: "none",
    textAlign: "center",
  };
}
