import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import type { ReactNode } from "react";
import { SessionProvider } from "@/lib/session";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000"),
  title: { default: "NDPA Lens: evidence packs for NDPA compliance audits", template: "%s · NDPA Lens" },
  description:
    "NDPA Lens gives licensed DPCOs reproducible, signed technical evidence of how a client's website collects and shares personal data, white-labelled and mapped to the NDPA and GAID.",
  openGraph: {
    title: "NDPA Lens: evidence packs for NDPA compliance audits",
    description: "Reproducible, signed website evidence for DPCOs preparing Compliance Audit Returns.",
    type: "website",
    locale: "en_GB",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d12" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={`${geist.variable} ${geistMono.variable}`}>
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
