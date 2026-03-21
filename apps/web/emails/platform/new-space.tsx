import { Button, Heading, Text } from "@react-email/components";
import { PlatformLayout } from "../components/platform-layout";

interface NewSpaceEmailProps {
  spaceName: string;
  ownerName: string;
  dashboardUrl: string;
}

export default function NewSpaceEmail({
  spaceName = "My Space",
  ownerName = "there",
  dashboardUrl = "https://rogueops.app/dashboard",
}: NewSpaceEmailProps) {
  return (
    <PlatformLayout preview={`Your space "${spaceName}" is ready`}>
      <Heading style={heading}>Your space is live!</Heading>
      <Text style={text}>
        Hi {ownerName}, your new space <strong>{spaceName}</strong> has been
        created and is ready to go.
      </Text>
      <Text style={text}>
        Set up your branding, configure resources, and invite your first
        members.
      </Text>
      <Button href={dashboardUrl} style={button}>
        Open Dashboard
      </Button>
    </PlatformLayout>
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
  margin: "0 0 12px",
};

const button = {
  display: "inline-block",
  backgroundColor: "#18181b",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "500" as const,
  padding: "10px 24px",
  borderRadius: "6px",
  textDecoration: "none",
  marginTop: "8px",
};
