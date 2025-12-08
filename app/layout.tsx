// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Speech → PII Extractor | Jai Patel",
  description: "Convert free-form Hindi/English conversation to text and extract PII in clean table format.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
            <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/40 text-sm font-bold text-emerald-300">
                  PII
                </span>
                <div>
                  <div className="font-semibold text-sm">
                    Speech → PII Extractor
                  </div>
                  <div className="text-xs text-slate-400">
                    by Jai Patel · experimental
                  </div>
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t border-slate-800 text-xs text-slate-500 py-3 text-center">
            Made with ❤️ · Experimenting with speech, text & privacy
          </footer>
        </div>
      </body>
    </html>
  );
}
