import { Button, Heading, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, colors, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface InviteEmailProps {
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

export default function InviteEmail({
  tenant = previewTenant,
  actionUrl = "https://urbanhive.rogueops.app/auth/callback?token_hash=abc123&type=invite",
}: InviteEmailProps) {
  return (
    <TenantLayout
      preview={`You've been invited to ${tenant.name}`}
      tenant={tenant}
    >
      <Heading style={text.heading}>
        You&apos;ve been invited to {tenant.name}
      </Heading>
      <Text style={text.body}>
        You&apos;ve been invited to join <strong>{tenant.name}</strong> as a
        member. Click below to accept and set up your account.
      </Text>
      <Button href={actionUrl} style={buttonStyle(tenant.primaryColor)}>
        Accept Invite
      </Button>
      <Text style={hint}>
        If you weren&apos;t expecting this invite, you can safely ignore this
        email.
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
