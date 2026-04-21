import { Button, Heading, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface SpaceSignupEmailProps {
  tenant: TenantBranding;
  memberName: string;
  dashboardUrl: string;
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

export default function SpaceSignupEmail({
  tenant = previewTenant,
  memberName = "there",
  dashboardUrl = "https://urbanhive.rogueops.app/dashboard",
}: SpaceSignupEmailProps) {
  return (
    <TenantLayout preview={`Welcome to ${tenant.name}`} tenant={tenant}>
      <Heading style={text.heading}>Welcome to {tenant.name}!</Heading>
      <Text style={text.body}>
        Hi {memberName}, your account has been set up. You can now browse
        available resources and make bookings.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle(tenant.primaryColor)}>
        Get Started
      </Button>
    </TenantLayout>
  );
}
