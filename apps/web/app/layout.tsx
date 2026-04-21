import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/react";
import { Providers } from "./providers";
import "./globals.css";

const outfit = localFont({
  src: "./fonts/outfit-latin-variable.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

const dmSans = localFont({
  src: "./fonts/dm-sans-latin-variable.woff2",
  variable: "--font-body",
  weight: "400 700",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-variable.woff2",
  variable: "--font-mono",
  weight: "400 700",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "RogueOps",
    template: "%s | RogueOps",
  },
  description: "Space management platform",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}
