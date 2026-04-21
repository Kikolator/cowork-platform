import { Button, Heading, Section, Text } from "@react-email/components";
import { TenantLayout } from "../components/tenant-layout";
import { buttonStyle, detailBox, text } from "../components/styles";
import type { TenantBranding } from "../components/tenant-layout";

interface BookingConfirmationEmailProps {
  tenant: TenantBranding;
  memberName: string;
  resourceName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingUrl: string;
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

export default function BookingConfirmationEmail({
  tenant = previewTenant,
  memberName = "there",
  resourceName = "Desk A1",
  date = "March 21, 2026",
  startTime = "09:00",
  endTime = "18:00",
  bookingUrl = "https://urbanhive.rogueops.app/bookings",
}: BookingConfirmationEmailProps) {
  return (
    <TenantLayout
      preview={`Booking confirmed: ${resourceName} on ${date}`}
      tenant={tenant}
    >
      <Heading style={text.heading}>Booking Confirmed</Heading>
      <Text style={text.body}>Hi {memberName}, your booking is confirmed.</Text>

      <Section style={detailBox.wrapper}>
        <Text style={detailBox.label}>Resource</Text>
        <Text style={detailBox.value}>{resourceName}</Text>
        <Text style={detailBox.label}>Date</Text>
        <Text style={detailBox.value}>{date}</Text>
        <Text style={detailBox.label}>Time</Text>
        <Text style={{ ...detailBox.value, margin: "0" }}>
          {startTime} &ndash; {endTime}
        </Text>
      </Section>

      <Button href={bookingUrl} style={buttonStyle(tenant.primaryColor)}>
        View Booking
      </Button>
    </TenantLayout>
  );
}
