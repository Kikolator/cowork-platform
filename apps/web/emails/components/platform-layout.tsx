import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const PLATFORM_NAME = "Cowork Platform";
const PLATFORM_URL = "https://rogueops.app";
const LOGO_URL = `${PLATFORM_URL}/logo.png`;

interface PlatformLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function PlatformLayout({ preview, children }: PlatformLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          {/* Platform header */}
          <Section style={header}>
            <Img src={LOGO_URL} width="140" height="40" alt={PLATFORM_NAME} />
          </Section>

          {/* Content */}
          <Section style={content}>{children}</Section>

          {/* Platform footer */}
          <Hr style={hr} />
          <Section style={footer}>
            <Text style={footerText}>
              Sent by{" "}
              <Link href={PLATFORM_URL} style={link}>
                {PLATFORM_NAME}
              </Link>
            </Text>
            <Text style={footerMuted}>
              &copy; {new Date().getFullYear()} {PLATFORM_NAME}. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  margin: "0",
  padding: "0",
};

const container = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 20px",
};

const header = {
  textAlign: "center" as const,
  paddingBottom: "24px",
};

const content = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "32px 24px",
  border: "1px solid #e4e4e7",
};

const hr = {
  borderColor: "#e4e4e7",
  margin: "24px 0",
};

const footer = {
  textAlign: "center" as const,
};

const footerText = {
  fontSize: "13px",
  color: "#71717a",
  margin: "0 0 4px",
};

const footerMuted = {
  fontSize: "12px",
  color: "#a1a1aa",
  margin: "0",
};

const link = {
  color: "#18181b",
  textDecoration: "underline",
};
