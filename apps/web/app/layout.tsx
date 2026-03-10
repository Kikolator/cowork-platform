import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const outfit = localFont({
  src: "./fonts/outfit-latin-variable.woff2",
  variable: "--font-display",
  weight: "400 700",
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
  description: "Coworking management platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
