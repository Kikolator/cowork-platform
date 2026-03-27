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

export interface TenantBranding {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
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
      <Body style={body}>
        <Container style={container}>
          {/* Tenant header */}
          <Section style={header}>
            {tenant.logoUrl ? (
              <Img
                src={tenant.logoUrl}
                width="140"
                height="40"
                alt={tenant.name}
                style={{ objectFit: "contain" }}
              />
            ) : (
              <Text style={{ ...tenantName, color: brandColor }}>
                {tenant.name}
              </Text>
            )}
          </Section>

          {/* Brand accent bar */}
          <Section
            style={{ ...accentBar, backgroundColor: brandColor }}
          />

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Tenant footer with business details */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerName}>{tenant.name}</Text>
            {(tenant.address || tenant.city) && (
              <Text style={footerAddress}>
                {[tenant.address, tenant.city].filter(Boolean).join(", ")}
              </Text>
            )}
            <Text style={footerLink}>
              <Link href={tenant.spaceUrl} style={link}>
                {tenant.spaceUrl.replace(/^https?:\/\//, "")}
              </Link>
            </Text>
            <Text style={poweredBy}>
              Powered by{" "}
              <Link href="https://rogueops.app" style={link}>
                Cowork Platform
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header = {
  textAlign: "center" as const,
  paddingBottom: "16px",
};

const tenantName = {
  fontSize: "22px",
  fontWeight: "700" as const,
  margin: "0",
};

const accentBar = {
  height: "3px",
  borderRadius: "2px",
  marginBottom: "0",
};

const content = {
  backgroundColor: "#ffffff",
  borderRadius: "0 0 8px 8px",
  padding: "32px 24px",
  border: "1px solid #e4e4e7",
  borderTop: "none",
};

const hr = {
  borderColor: "#e4e4e7",
  margin: "24px 0",
};

const footer = {
  textAlign: "center" as const,
};

const footerName = {
  fontSize: "13px",
  fontWeight: "600" as const,
  color: "#3f3f46",
  margin: "0 0 4px",
};

const footerAddress = {
  fontSize: "12px",
  color: "#71717a",
  margin: "0 0 4px",
};

const footerLink = {
  fontSize: "12px",
  color: "#71717a",
  margin: "0 0 8px",
};

const link = {
  color: "#71717a",
  textDecoration: "underline",
};

const poweredBy = {
  fontSize: "11px",
  color: "#a1a1aa",
  margin: "8px 0 0",
};
