import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import { colors, layout, PLATFORM_NAME, PLATFORM_URL } from "./styles";

export interface TenantBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  address: string | null;
  city: string | null;
  spaceUrl: string;
}

interface TenantLayoutProps {
  preview: string;
  tenant: TenantBranding;
  children: React.ReactNode;
}

export function TenantLayout({ preview, tenant, children }: TenantLayoutProps) {
  const brandColor = tenant.primaryColor || "#000000";

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={layout.body}>
        <Container style={layout.container}>
          {/* Space identity */}
          <Section style={layout.header}>
            {tenant.logoUrl ? (
              <Img
                src={tenant.logoUrl}
                width="140"
                height="40"
                alt={tenant.name}
                style={{ objectFit: "contain", margin: "0 auto" }}
              />
            ) : (
              <Text style={{ ...logoText, color: brandColor }}>
                {tenant.name}
              </Text>
            )}
          </Section>

          {/* Accent bar (rounded top) + content card (rounded bottom) */}
          <Section
            style={{
              ...accentBar,
              backgroundColor: brandColor,
            }}
          />
          <Section style={card}>{children}</Section>

          {/* Space footer */}
          <Hr style={layout.hr} />
          <Section style={layout.footerCenter}>
            <Text style={footerName}>{tenant.name}</Text>
            {(tenant.address || tenant.city) && (
              <Text style={footerAddress}>
                {[tenant.address, tenant.city].filter(Boolean).join(", ")}
              </Text>
            )}
            <Text style={footerUrl}>
              <Link href={tenant.spaceUrl} style={footerLink}>
                {tenant.spaceUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
            <Text style={poweredBy}>
              Powered by{" "}
              <Link href={PLATFORM_URL} style={poweredByLink}>
                {PLATFORM_NAME}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ── Header styles ───────────────────────────────────────────── */

const logoText = {
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0",
  textAlign: "center" as const,
};

/* ── Card styles (accent bar + card form a single visual unit) ─ */

const accentBar = {
  height: "4px",
  borderRadius: "8px 8px 0 0",
};

const card = {
  backgroundColor: colors.card,
  borderRadius: "0 0 8px 8px",
  padding: "32px 24px",
  border: `1px solid ${colors.border}`,
  borderTop: "none",
};

/* ── Footer styles ───────────────────────────────────────────── */

const footerName = {
  fontSize: "13px",
  fontWeight: "600" as const,
  color: colors.body,
  margin: "0 0 4px",
};

const footerAddress = {
  fontSize: "12px",
  color: colors.muted,
  margin: "0 0 4px",
};

const footerUrl = {
  fontSize: "12px",
  color: colors.muted,
  margin: "0 0 12px",
};

const footerLink = {
  color: colors.muted,
  textDecoration: "underline",
};

const poweredBy = {
  fontSize: "11px",
  color: colors.faint,
  margin: "0",
};

const poweredByLink = {
  color: colors.faint,
  textDecoration: "underline",
};
