import type { Metadata } from "next";
import type { ReactNode } from "react";

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
        <div className="site-shell">
          <SiteHeader />

          <main className="flex-1">{children}</main>

          <footer className="site-footer">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted md:flex-row md:items-center md:justify-between">
              <span>Lean, production-style SaaS scaffold for recruiter workflows.</span>
              <span>Consent-aware · Privacy-first · Shareable read-only sessions</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
