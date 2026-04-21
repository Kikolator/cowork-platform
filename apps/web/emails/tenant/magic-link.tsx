import { Button, Heading, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, colors, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface MagicLinkEmailProps {
  tenant: TenantBranding;
  actionUrl: string;
}

const previewTenant: TenantBranding = {
  name: "Urban Hive",
  logoUrl: null,
  primaryColor: "#2563eb",
  accentColor: "#3b82f6",
  address: "Carrer de Mallorca 401",
  city: "Barcelona",
  spaceUrl: "https://urbanhive.rogueops.app",
};

export default function MagicLinkEmail({
  tenant = previewTenant,
  actionUrl = "https://urbanhive.rogueops.app/auth/callback?token_hash=abc123&type=magiclink",
}: MagicLinkEmailProps) {
  return (
    <TenantLayout
      preview={`Sign in to ${tenant.name}`}
      tenant={tenant}
    >
      <Heading style={text.heading}>Sign in to {tenant.name}</Heading>
      <Text style={text.body}>
        Click the button below to securely sign in. This link expires in 1 hour.
      </Text>
      <Button href={actionUrl} style={buttonStyle(tenant.primaryColor)}>
        Sign In
      </Button>
      <Text style={hint}>
        If you didn&apos;t request this, you can safely ignore this email.
      </Text>
    </TenantLayout>
  );
}

const hint = {
  fontSize: "13px",
  lineHeight: "1.5",
  color: colors.muted,
  margin: "16px 0 0",
};
