import { Button, Heading, Text } from "@react-email/components";
import { TenantBranding, TenantLayout } from "../components/tenant-layout";

interface SpaceSignupEmailProps {
  tenant: TenantBranding;
  memberName: string;
  dashboardUrl: string;
}

export default function SpaceSignupEmail({
  tenant = {
    name: "Urban Hive",
    logoUrl: null,
    primaryColor: "#000000",
    address: "123 Main St",
    city: "Barcelona",
    spaceUrl: "https://urbanhive.rogueops.app",
  },
  memberName = "there",
  dashboardUrl = "https://urbanhive.rogueops.app/dashboard",
}: SpaceSignupEmailProps) {
  return (
    <TenantLayout
      preview={`Welcome to ${tenant.name}`}
      tenant={tenant}
    >
      <Heading style={heading}>Welcome to {tenant.name}!</Heading>
      <Text style={text}>
        Hi {memberName}, your account has been set up. You can now browse
        available resources and make bookings.
      </Text>
      <Button href={dashboardUrl} style={button(tenant.primaryColor)}>
        Get Started
      </Button>
    </TenantLayout>
  );
}

const heading = {
  fontSize: "20px",
  fontWeight: "600" as const,
  color: "#18181b",
  margin: "0 0 16px",
};

const text = {
  fontSize: "15px",
  lineHeight: "1.6",
  color: "#3f3f46",
  margin: "0 0 16px",
};

const button = (color: string) => ({
  display: "inline-block" as const,
  backgroundColor: color || "#18181b",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "500" as const,
  padding: "10px 24px",
  borderRadius: "6px",
  textDecoration: "none",
});
