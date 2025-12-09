"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

export default function HomePage() {
  // Hydration-safe: pehle sirf lightweight loading dikhayenge
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center text-xs text-slate-400">
          Loading…
        </div>

        {/* Feedback widget script – already safe to load */}
        <Script
          src="https://feedback-jai-patel.vercel.app/widget.js?from=Speech%20PII%20Extractor"
          strategy="afterInteractive"
        />
      </>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 py-20 text-center space-y-8">
        {/* TITLE */}
        <h1 className="text-4xl font-bold tracking-tight leading-snug">
          Turn conversations into{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            structured HR data
          </span>
        </h1>

        {/* SUBTEXT */}
        <p className="text-base text-slate-300 leading-relaxed">
          Speak in Hindi, English or mixed Hinglish. We&apos;ll transcribe your
          conversation and automatically extract{" "}
          <span className="text-emerald-300 font-medium">
            name, openings, role, budget, experience
          </span>{" "}
          and other HR details in a neat table.
        </p>

        {/* MAIN CTA */}
        <div className="mt-6 flex justify-center">
          <Link
            href="/capture"
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 
                       px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 
                       hover:scale-[1.03] active:scale-[0.98] transition-all"
          >
            Let&apos;s get started →
          </Link>
        </div>

        {/* SMALL NOTE */}
        <p className="text-[11px] text-slate-500 max-w-md mx-auto pt-2">
          Prototype for HR teams. Please avoid sharing highly sensitive ID
          numbers (Aadhaar, PAN, bank details, etc.).
        </p>

        {/* PORTFOLIO LINK */}
        <div className="text-[12px] text-slate-400 pt-4">
          Want to explore more of my apps?{" "}
          <a
            href="https://vermajai1995.vercel.app/"
            target="_blank"
            rel="noreferrer"
            className="text-emerald-300 underline-offset-2 hover:underline"
          >
            Visit my portfolio →
          </a>
        </div>
      </div>

      {/* Feedback Widget Loader */}
      <Script
        src="https://feedback-jai-patel.vercel.app/widget.js?from=Speech%20PII%20Extractor"
        strategy="afterInteractive"
      />
    </>
  );
}
