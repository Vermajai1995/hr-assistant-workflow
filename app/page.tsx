"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <section className="hero-panel min-h-[72vh] justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">HireFlow</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance">
            Speech to recruiter-ready hiring requirements, built for real workflows.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            Capture Hinglish or English hiring conversations, extract structured role fields, refine them with AI, and share a polished read-only handoff in minutes.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/capture" className="primary-link">
              Open workspace
            </Link>
            <a
              href="#capabilities"
              className="ghost-link"
            >
              Explore capabilities
            </a>
          </div>
        </div>

        <div className="dashboard-preview">
          <div className="preview-card">
            <span className="pill">Consent-first</span>
            <span className="pill">Dynamic fields</span>
            <span className="pill">Read-only share mode</span>
          </div>
          <div className="preview-panel">
            <p className="eyebrow">What HireFlow now covers</p>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>Voice, transcript, and file intake in one screen</li>
              <li>Privacy redaction before AI processing</li>
              <li>Suggested fields like tech stack, work mode, and notice period</li>
              <li>Recent sessions with reload and edit support</li>
              <li>HR brief, email draft, JD, and WhatsApp output generation</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="capabilities" className="mt-10 grid gap-4 md:grid-cols-3">
        {CAPABILITIES.map((item) => (
          <article key={item.title} className="panel p-6">
            <p className="eyebrow">{item.kicker}</p>
            <h2 className="mt-3 text-2xl font-semibold">{item.title}</h2>
            <p className="mt-3 text-sm leading-7 text-muted">{item.description}</p>
          </article>
        ))}
      </section>
    </div>
  );
}

const CAPABILITIES = [
  {
    kicker: "Cleaner architecture",
    title: "Modular app and API layers",
    description:
      "Shared server modules now handle AI requests, rate limits, redaction, outputs, and logging so the UI can stay focused on product flow.",
  },
  {
    kicker: "Safer defaults",
    title: "Consent and privacy built in",
    description:
      "Recording requires consent and the backend redacts sensitive identity or banking patterns before anything reaches the model.",
  },
  {
    kicker: "Production flow",
    title: "Sessions, sharing, and polished outputs",
    description:
      "Recent local sessions, editable structured fields, suggested field detection, and read-only share links make the MVP feel like a usable SaaS product.",
  },
];
