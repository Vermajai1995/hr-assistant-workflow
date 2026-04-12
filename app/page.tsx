"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <section className="hero-panel min-h-[72vh] items-center justify-between">
        <div className="max-w-3xl">
          <p className="eyebrow">HireFlow</p>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight text-balance text-slate-900">
            Capture hiring conversations, structure the details, and generate recruiter-ready output.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">
            HireFlow turns calls, notes, and uploaded briefs into structured hiring requirements, HR summaries, emails, job descriptions, and WhatsApp-ready updates.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/capture" className="primary-link">
              Open Workspace
            </Link>
            <a
              href="https://pateljai.com/#projects"
              target="_blank"
              rel="noreferrer"
              className="ghost-link"
            >
              View Portfolio
            </a>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {HIGHLIGHTS.map((item) => (
              <article key={item.title} className="panel p-5">
                <p className="eyebrow">{item.kicker}</p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted">{item.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="dashboard-preview">
          <div className="preview-panel">
            <p className="eyebrow">Workflow</p>
            <div className="mt-4 space-y-4">
              <div className="landing-step">
                <span className="landing-step-index">1</span>
                <div>
                  <strong>Capture</strong>
                  <p className="text-sm text-muted">
                    Record, upload, or paste hiring conversations into a single workspace.
                  </p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step-index">2</span>
                <div>
                  <strong>Structure</strong>
                  <p className="text-sm text-muted">
                    Review extracted fields and fine-tune the data before moving ahead.
                  </p>
                </div>
              </div>
              <div className="landing-step">
                <span className="landing-step-index">3</span>
                <div>
                  <strong>Generate</strong>
                  <p className="text-sm text-muted">
                    Switch across HR brief, email, JD, and WhatsApp outputs in tabs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

const HIGHLIGHTS = [
  {
    kicker: "Capture",
    title: "Voice, text, and files",
    description: "Bring in recruiter calls, pasted chats, PDFs, DOCX files, or live transcription.",
  },
  {
    kicker: "Review",
    title: "Structured hiring fields",
    description: "Check role, budget, location, skills, and supporting attributes in one step.",
  },
  {
    kicker: "Generate",
    title: "Recruiter-ready outputs",
    description: "Create polished briefs, emails, JDs, and WhatsApp summaries without extra cleanup.",
  },
];
