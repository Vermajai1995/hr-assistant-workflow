// app/layout.tsx
import "./globals.css";
import Image from "next/image";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "Speech → PII Extractor | Jai Patel",
  description:
    "Transcribe conversations & extract structured hiring details automatically.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-850 to-slate-950 text-slate-100">
        {/* HEADER (sticky) */}
        <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-lg">
          <div className="mx-auto max-w-4xl px-4 py-2 flex items-center gap-3">
            {/* LOGO */}
            <a
              href="https://vermajai1995.vercel.app/"
              className="h-9 w-9 rounded-xl overflow-hidden border border-slate-700 shadow hover:opacity-90 transition"
              title="Open portfolio"
            >
              <Image
                src="/logo.png"
                alt="Logo"
                width={40}
                height={40}
                className="object-cover"
              />
            </a>

            {/* TITLE BLOCK */}
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold text-slate-100">
                Speech → PII Extractor
              </span>
              <span className="text-[11px] text-emerald-400/90">
                by Jai Patel · Experimental HR Automation
              </span>
            </div>
          </div>
        </header>

        {/* MAIN */}
        <main className="flex-1">
          {children}

          {/* Feedback Widget Loader */}
          <Script
            src="https://feedback-jai-patel.vercel.app/?from=PII+Assistant"
            strategy="afterInteractive"
          />
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-800 text-[11px] text-slate-500 py-2.5 text-center">
          Made with ❤️ · Automating HR workflows · Powered by OpenRouter
        </footer>
      </body>
    </html>
  );
}
