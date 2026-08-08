import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

import { APP_CONFIG, pageTitle } from "@/lib/app-config";

import "./globals.css";

/**
 * Type system: a warm humanist sans for every interface line, a characterful
 * serif reserved for page-title moments, and a mono for codes. Deliberately
 * not Geist — Next.js's own scaffold font reads as an unstyled default the
 * instant it's paired with a custom brand palette.
 */
const sans = Plus_Jakarta_Sans({
  variable: "--font-jakarta-sans",
  subsets: ["latin"],
});

const display = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz", "SOFT", "WONK"],
});

const mono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: pageTitle(APP_CONFIG.tagline),
  description: APP_CONFIG.shortDescription,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
