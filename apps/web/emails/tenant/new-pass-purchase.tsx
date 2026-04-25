import { Button, Heading, Section, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, detailBox, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface NewPassPurchaseEmailProps {
  tenant: TenantBranding;
  visitorName: string;
  visitorEmail: string;
  passType: string;
  startDate: string;
  endDate: string;
  amountFormatted: string;
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

export default function NewPassPurchaseEmail({
  tenant = previewTenant,
  visitorName = "Jane Doe",
  visitorEmail = "jane@example.com",
  passType = "Day Pass",
  startDate = "March 21, 2026",
  endDate = "March 21, 2026",
  amountFormatted = "$25.00",
  dashboardUrl = "https://urbanhive.rogueops.app/admin/passes",
}: NewPassPurchaseEmailProps) {
  return (
    <TenantLayout
      preview={`New pass purchase: ${visitorName || visitorEmail}`}
      tenant={tenant}
    >
      <Heading style={text.heading}>New Pass Purchase</Heading>
      <Text style={text.body}>
        A visitor just purchased a pass for your space.
      </Text>

      <Section style={detailBox.wrapper}>
        <Text style={detailBox.label}>Visitor</Text>
        <Text style={detailBox.value}>
          {visitorName ? `${visitorName} (${visitorEmail})` : visitorEmail}
        </Text>
        <Text style={detailBox.label}>Pass Type</Text>
        <Text style={detailBox.value}>{passType}</Text>
        <Text style={detailBox.label}>Dates</Text>
        <Text style={detailBox.value}>
          {startDate === endDate ? startDate : `${startDate} \u2013 ${endDate}`}
        </Text>
        <Text style={detailBox.label}>Amount</Text>
        <Text style={{ ...detailBox.value, margin: "0" }}>
          {amountFormatted}
        </Text>
      </Section>

      <Button href={dashboardUrl} style={buttonStyle(tenant.primaryColor)}>
        View Passes
      </Button>
    </TenantLayout>
  );
}
