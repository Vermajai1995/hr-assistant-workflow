import Link from "next/link";

import { getShareRecord } from "@/lib/server/share-store";

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const record = await getShareRecord(shareId);

  if (!record) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20">
        <div className="panel p-8">
          <p className="eyebrow">Share not found</p>
          <h1 className="mt-3 text-3xl font-semibold">This read-only session is unavailable.</h1>
          <p className="mt-3 text-sm text-muted">
            The link may be invalid, expired, or removed.
          </p>
          <Link href="/" className="primary-link mt-6 inline-flex">
            Go back to HireFlow
          </Link>
        </div>
      </div>
    );
  }

  const { snapshot } = record;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="panel p-8">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Read-only session</p>
            <h1 className="mt-2 text-3xl font-semibold">{snapshot.title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-muted">
              Shared from HireFlow. This view is read-only and preserves the extracted table, AI outputs, and privacy warnings.
            </p>
          </div>
          <Link href="/" className="ghost-link inline-flex">
            Open HireFlow
          </Link>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4">
            <div className="panel-soft p-5">
              <h2 className="text-lg font-semibold">Transcript</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-200/90">
                {snapshot.transcript}
              </p>
            </div>

            <div className="panel-soft p-5">
              <h2 className="text-lg font-semibold">Extracted fields</h2>
              <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-white/5 text-slate-300">
                    <tr>
                      <th className="px-4 py-3">Field</th>
                      <th className="px-4 py-3">Value</th>
                      <th className="px-4 py-3">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.rows.map((row) => (
                      <tr key={row.id || `${row.field}-${row.value}`} className="border-t border-white/10">
                        <td className="px-4 py-3 text-slate-200">{row.field}</td>
                        <td className="px-4 py-3 text-slate-100">{row.value}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {row.confidence.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="panel-soft p-5">
              <h2 className="text-lg font-semibold">Warnings</h2>
              {snapshot.warnings.length ? (
                <ul className="mt-4 space-y-3 text-sm text-slate-200">
                  {snapshot.warnings.map((warning, index) => (
                    <li key={`${warning.type}-${index}`} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                      <strong className="text-amber-200">{warning.label}</strong>
                      <p className="mt-1 text-slate-300">{warning.message}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">No sensitive content warnings were raised.</p>
              )}
            </div>

            <div className="panel-soft p-5">
              <h2 className="text-lg font-semibold">Generated outputs</h2>
              <div className="mt-4 space-y-4 text-sm">
                <OutputBlock title="HR brief" content={snapshot.outputs.brief} />
                <OutputBlock title="Email draft" content={snapshot.outputs.email} />
                <OutputBlock title="JD" content={snapshot.outputs.jd} />
                <OutputBlock title="WhatsApp" content={snapshot.outputs.whatsapp} />
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function OutputBlock({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
        {content || "Not generated"}
      </p>
    </div>
  );
}
