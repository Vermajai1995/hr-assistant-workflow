import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import Script from "next/script";

import { GlobalLoaderProvider } from "@/components/global-loader";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const siteUrl = "https://hireflow.pateljai.com";
const ogImageUrl = `${siteUrl}/og-image.png`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "HireFlow – AI HR Requirement Extractor",
  description:
    "Paste or record hiring conversations and instantly generate HR briefs, JDs, emails, and WhatsApp-ready summaries. No data stored. Runs fully in your browser.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/icon-192.png",
  },
  openGraph: {
    title: "HireFlow – Convert Hiring Calls into Structured HR Outputs in Seconds",
    description:
      "Paste or record hiring conversations and instantly generate HR briefs, JDs, emails, and WhatsApp-ready summaries. No data stored. Runs fully in your browser.",
    url: siteUrl,
    type: "website",
    images: [
      {
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: "HireFlow preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "HireFlow – Convert Hiring Calls into Structured HR Outputs in Seconds",
    description:
      "Paste or record hiring conversations and instantly generate HR briefs, JDs, emails, and WhatsApp-ready summaries. No data stored. Runs fully in your browser.",
    images: [ogImageUrl],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <GlobalLoaderProvider>
          <div className="site-shell">
            <SiteHeader />

            <main className="flex-1">{children}</main>

            <footer className="site-footer">
              <div className="site-footer-inner">
                <span>Privacy-first recruiter workspace.</span>
                <Link target="_blank" href="/privacy" className="footer-link">
                  Privacy & Terms
                </Link>
              </div>
            </footer>

            <a
              href="https://feedback-jai-patel.vercel.app/?from=hr-assistant"
              target="_blank"
              rel="noreferrer"
              className="feedback-fab"
            >
              Feedback
            </a>
          </div>
        </GlobalLoaderProvider>
        <Script
          src="https://feedback-jai-patel.vercel.app/?from=hr-assistant"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
