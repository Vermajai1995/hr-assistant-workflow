// app/page.tsx
"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="space-y-6 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">
          Turn conversations into{" "}
          <span className="text-emerald-400">structured PII</span>
        </h1>
        <p className="text-sm text-slate-400">
          Speak in Hindi, English or mix. We’ll transcribe the conversation and
          auto-extract personal details like name, email, phone, etc. in a neat
          table you can copy or export.
        </p>

        <div className="mt-8">
          <Link
            href="/capture"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-medium text-slate-900 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 transition"
          >
            Let&apos;s get started
            <span aria-hidden>→</span>
          </Link>
        </div>

        <p className="text-[11px] text-slate-500 mt-6">
          Note: This is a local prototype. Always be careful while speaking or
          pasting highly sensitive data (bank, Aadhaar, etc.).
        </p>
      </div>
    </div>
  );
}
