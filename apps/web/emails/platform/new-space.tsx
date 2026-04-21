import { Button, Heading, Text } from "@react-email/components";
import { PlatformLayout } from "../components/platform-layout";
import { buttonStyle, text } from "../components/styles";

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
      <Heading style={text.heading}>Your space is live!</Heading>
      <Text style={text.body}>
        Hi {ownerName}, your new space <strong>{spaceName}</strong> has been
        created and is ready to go.
      </Text>
      <Text style={text.body}>
        Set up your branding, configure resources, and invite your first
        members.
      </Text>
      <Button href={dashboardUrl} style={buttonStyle()}>
        Open Dashboard
      </Button>
    </PlatformLayout>
  );
}
