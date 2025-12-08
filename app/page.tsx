"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-8">

      {/* TITLE */}
      <h1 className="text-4xl font-bold tracking-tight">
        Turn conversations into{" "}
        <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
          structured PII
        </span>
      </h1>

      {/* SUBTEXT */}
      <p className="text-base text-slate-300 leading-relaxed">
        Speak in Hindi, English or mixed Hinglish.  
        We’ll transcribe your conversation and automatically extract  
        <span className="text-emerald-300 font-medium"> HR-relevant details</span>  
        like name, openings, role, budget, experience and more.
      </p>

      {/* BUTTON */}
      <div className="mt-10">
        <Link
          href="/capture"
          className="inline-flex items-center gap-2 rounded-xl 
          bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-900 
          shadow-xl shadow-emerald-500/40 hover:bg-emerald-400 
          hover:shadow-emerald-400/40 active:scale-[0.98]
          transition-all"
        >
          Let&apos;s get started
          <span aria-hidden>→</span>
        </Link>
      </div>

      {/* NOTE */}
      <p className="text-[11px] text-slate-500 max-w-md mx-auto pt-3">
        Note: This is an early HR automation prototype.  
        Avoid sharing sensitive government IDs (Aadhaar, PAN, etc.).
      </p>
    </div>
  );
}
