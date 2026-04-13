import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";

import { GlobalLoaderProvider } from "@/components/global-loader";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: "HireFlow",
  description:
    "Speech to structured HR requirement extraction for recruiters and hiring teams.",
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
          </div>
        </GlobalLoaderProvider>
      </body>
    </html>
  );
}
