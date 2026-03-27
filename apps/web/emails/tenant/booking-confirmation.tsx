import { Button, Heading, Section, Text } from "@react-email/components";
import { TenantBranding, TenantLayout } from "../components/tenant-layout";

interface BookingConfirmationEmailProps {
  tenant: TenantBranding;
  memberName: string;
  resourceName: string;
  date: string;
  startTime: string;
  endTime: string;
  bookingUrl: string;
}

export default function BookingConfirmationEmail({
  tenant = {
    name: "Urban Hive",
    logoUrl: null,
    primaryColor: "#000000",
    address: "123 Main St",
    city: "Barcelona",
    spaceUrl: "https://urbanhive.rogueops.app",
  },
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
      <Heading style={heading}>Booking Confirmed</Heading>
      <Text style={text}>Hi {memberName}, your booking is confirmed.</Text>

      <Section style={detailsBox}>
        <Text style={detailLabel}>Resource</Text>
        <Text style={detailValue}>{resourceName}</Text>
        <Text style={detailLabel}>Date</Text>
        <Text style={detailValue}>{date}</Text>
        <Text style={detailLabel}>Time</Text>
        <Text style={detailValue}>
          {startTime} – {endTime}
        </Text>
      </Section>

      <Button href={bookingUrl} style={button(tenant.primaryColor)}>
        View Booking
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

const detailsBox = {
  backgroundColor: "#fafafa",
  borderRadius: "6px",
  padding: "16px 20px",
  marginBottom: "20px",
  border: "1px solid #e4e4e7",
};

const detailLabel = {
  fontSize: "12px",
  fontWeight: "500" as const,
  color: "#71717a",
  textTransform: "uppercase" as const,
  letterSpacing: "0.05em",
  margin: "0 0 2px",
};

const detailValue = {
  fontSize: "15px",
  color: "#18181b",
  margin: "0 0 12px",
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
