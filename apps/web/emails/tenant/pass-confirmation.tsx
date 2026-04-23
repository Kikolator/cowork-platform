import { Button, Heading, Markdown, Section, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, detailBox, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface PassConfirmationEmailProps {
  tenant: TenantBranding;
  memberName: string;
  passType: string;
  startDate: string;
  endDate: string;
  deskName: string | null;
  doorCode: string | null;
  wifiNetwork: string | null;
  wifiPassword: string | null;
  communityRulesSummary: string | null;
  dashboardUrl: string;
  /** When provided, the CTA becomes a magic link that signs the user in. */
  magicLinkUrl?: string;
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

export default function PassConfirmationEmail({
  tenant = previewTenant,
  memberName = "there",
  passType = "Day Pass",
  startDate = "Wed 23 Apr 2026",
  endDate = "Wed 23 Apr 2026",
  deskName = "Desk A3",
  doorCode = "1234",
  wifiNetwork = "UrbanHive-WiFi",
  wifiPassword = "cowork2026",
  communityRulesSummary = null,
  dashboardUrl = "https://urbanhive.rogueops.app/dashboard",
  magicLinkUrl,
}: PassConfirmationEmailProps) {
  const isSingleDay = startDate === endDate;
  const dateDisplay = isSingleDay ? startDate : `${startDate} \u2013 ${endDate}`;

  return (
    <TenantLayout
      preview={`${passType} confirmed \u2014 ${dateDisplay}`}
      tenant={tenant}
    >
      <Heading style={text.heading}>{passType} Confirmed</Heading>
      <Text style={text.body}>
        Hi {memberName}, your pass is confirmed. Here&apos;s everything you need.
      </Text>

      {/* Pass details */}
      <Section style={detailBox.wrapper}>
        <Text style={detailBox.label}>Pass</Text>
        <Text style={detailBox.value}>{passType}</Text>
        <Text style={detailBox.label}>
          {isSingleDay ? "Date" : "Dates"}
        </Text>
        <Text style={detailBox.value}>{dateDisplay}</Text>
        {deskName && (
          <>
            <Text style={detailBox.label}>Assigned Desk</Text>
            <Text style={{ ...detailBox.value, margin: "0" }}>{deskName}</Text>
          </>
        )}
      </Section>

      {/* Access info */}
      {(doorCode || wifiNetwork) && (
        <Section style={detailBox.wrapper}>
          <Text style={{ ...detailBox.label, marginBottom: "8px" }}>
            Access Information
          </Text>
          {doorCode && (
            <>
              <Text style={detailBox.label}>Door Code</Text>
              <Text style={detailBox.value}>{doorCode}</Text>
            </>
          )}
          {wifiNetwork && (
            <>
              <Text style={detailBox.label}>WiFi Network</Text>
              <Text style={detailBox.value}>{wifiNetwork}</Text>
            </>
          )}
          {wifiPassword && (
            <>
              <Text style={detailBox.label}>WiFi Password</Text>
              <Text style={{ ...detailBox.value, margin: "0" }}>
                {wifiPassword}
              </Text>
            </>
          )}
        </Section>
      )}

      {/* Community rules summary */}
      {communityRulesSummary && (
        <Section style={detailBox.wrapper}>
          <Text style={{ ...detailBox.label, marginBottom: "8px" }}>
            Community Rules
          </Text>
          <Markdown>{communityRulesSummary}</Markdown>
        </Section>
      )}

      <Button href={magicLinkUrl ?? dashboardUrl} style={buttonStyle(tenant.primaryColor)}>
        {magicLinkUrl ? "Sign In & View Pass" : "Go to Dashboard"}
      </Button>
    </TenantLayout>
  );
}
