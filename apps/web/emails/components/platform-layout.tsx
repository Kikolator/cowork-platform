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
import {
  colors,
  layout,
  PLATFORM_LOGO_URL,
  PLATFORM_NAME,
  PLATFORM_URL,
} from "./styles";

interface PlatformLayoutProps {
  preview: string;
  children: React.ReactNode;
}

export function PlatformLayout({ preview, children }: PlatformLayoutProps) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={layout.body}>
        <Container style={layout.container}>
          {/* RogueOps logo */}
          <Section style={layout.header}>
            <Img
              src={PLATFORM_LOGO_URL}
              width="140"
              height="40"
              alt={PLATFORM_NAME}
              style={{ margin: "0 auto" }}
            />
          </Section>

          {/* Content card */}
          <Section style={layout.card}>{children}</Section>

          {/* Footer */}
          <Hr style={layout.hr} />
          <Section style={layout.footerCenter}>
            <Text style={footerText}>
              Sent by{" "}
              <Link href={PLATFORM_URL} style={footerLink}>
                {PLATFORM_NAME}
              </Link>
            </Text>
            <Text style={copyright}>
              &copy; {new Date().getFullYear()} {PLATFORM_NAME}. All rights
              reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/* ── Footer styles ───────────────────────────────────────────── */

const footerText = {
  fontSize: "13px",
  color: colors.muted,
  margin: "0 0 4px",
};

const footerLink = {
  color: colors.heading,
  textDecoration: "underline",
};

const copyright = {
  fontSize: "12px",
  color: colors.faint,
  margin: "0",
};
