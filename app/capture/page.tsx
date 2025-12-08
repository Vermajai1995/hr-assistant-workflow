// app/capture/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type PiiRow = {
  field: string;
  value: string;
  category: string;
  confidence: number;
  snippet?: string;
};

type TabId = "transcript" | "pii";

// Minimal SpeechRecognition type (enough for our usage)
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      0: {
        transcript: string;
      };
    };
    length: number;
  };
}

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: ((this: SpeechRecognitionType, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognitionType, ev: any) => any) | null;
  onend: ((this: SpeechRecognitionType, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognitionType, ev: SpeechRecognitionEvent) => any) | null;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: {
      new (): SpeechRecognitionType;
    };
    SpeechRecognition?: {
      new (): SpeechRecognitionType;
    };
  }
}

// Preferred HR field order for display & brief
const FIELD_ORDER: string[] = [
  "Client Name",
  "Client Company / Agency",
  "Client Location / City",
  "Work Location",
  "Position Title",
  "Total Openings",
  "Experience Level",
  "Experience Required (years)",
  "Work Mode",
  "Required Skills / Tech Stack",
  "Budget Range (INR/month)",
  "Minimum Budget (INR/month)",
  "Maximum Budget (INR/month)",
  "Notice Period / Joining Timeline",
  "Contract Type",
  "Shift Timing",
  "Other Notes",
];

export default function CapturePage() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [transcript, setTranscript] = useState<string>("");
  const [piiRows, setPiiRows] = useState<PiiRow[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("transcript");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"hi-IN" | "en-IN" | "en-US">("hi-IN");
  const [hrBrief, setHrBrief] = useState<string>("");
  const [briefCopied, setBriefCopied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Sorted rows by preferred HR order
  const sortedRows = useMemo(() => {
    if (!piiRows.length) return [];

    return [...piiRows].sort((a, b) => {
      const aIdx = FIELD_ORDER.indexOf(a.field);
      const bIdx = FIELD_ORDER.indexOf(b.field);

      const aScore = aIdx === -1 ? FIELD_ORDER.length + 1 : aIdx;
      const bScore = bIdx === -1 ? FIELD_ORDER.length + 1 : bIdx;

      if (aScore === bScore) {
        // fallback: keep original relative order
        return piiRows.indexOf(a) - piiRows.indexOf(b);
      }
      return aScore - bScore;
    });
  }, [piiRows]);

  // Init / re-init speech recognition on language change
  useEffect(() => {
    if (typeof window === "undefined") return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setIsSupported(false);
      setStatus("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SR();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus(`Listening… (${lang}) Speak normally (Hindi/English).`);
      setError(null);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech error", event);
      setStatus(`Speech error: ${event.error || "unknown"}`);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatus("Stopped listening.");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      for (let i = 0; i < event.results.length; i++) {
        finalTranscript += event.results[i][0].transcript + " ";
      }
      setTranscript(finalTranscript.trim());
    };

    recognitionRef.current = recognition;
    setIsSupported(true);
    if (!isListening) {
      setStatus("Ready to listen.");
    }

    return () => {
      try {
        recognition.stop();
      } catch {
        // ignore
      }
    };
  }, [lang]); // language change pe naya recognition

  const startListening = () => {
    if (!recognitionRef.current) return;
    setPiiRows([]);
    setHrBrief("");
    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
      setError("Could not start microphone. Please check browser permissions.");
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.stop();
      setStatus("Stopping…");
      setTimeout(() => {
        if (transcript.trim().length > 0) {
          handleExtractPII(true);
        }
      }, 600);
    } catch (e) {
      console.error(e);
    }
  };

  const handleExtractPII = async (autoFromMic = false) => {
    const text = transcript.trim();
    if (!text) {
      setError("Please speak something first or paste a conversation.");
      return;
    }
    setIsExtracting(true);
    setError(null);
    setStatus("Extracting structured HR details…");
    setHrBrief("");
    setBriefCopied(false);

    try {
      const res = await fetch("/api/extract-pii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error || "Failed to extract PII");
      }

      setPiiRows(data.rows || []);
      setStatus(
        data.rows?.length
          ? `Found ${data.rows.length} key fields for this requirement.`
          : "No useful fields found in this conversation."
      );
      setActiveTab("pii");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unexpected error while extracting PII.");
      setStatus("Idle");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleCopyAsMarkdown = async () => {
    if (!sortedRows.length) return;

    const header =
      "| # | Field | Value | Category | Confidence | Snippet |\n" +
      "|---|-------|-------|----------|------------|---------|\n";

    const rowsStr = sortedRows
      .map((row, idx) => {
        const conf = row.confidence?.toFixed(2) ?? "";
        const snippet = row.snippet ? row.snippet.replace(/\n/g, " ") : "";
        return `| ${idx + 1} | ${escapeMd(row.field)} | ${escapeMd(
          row.value
        )} | ${escapeMd(row.category)} | ${conf} | ${escapeMd(snippet)} |`;
      })
      .join("\n");

    const table = header + rowsStr;

    try {
      await navigator.clipboard.writeText(table);
      setStatus("Table copied to clipboard (Markdown).");
    } catch (e) {
      setError("Failed to copy table to clipboard.");
    }
  };

  const handleExportCSV = () => {
    if (!sortedRows.length) return;

    let csv = "Index,Field,Value,Category,Confidence,Snippet\n";

    sortedRows.forEach((row, idx) => {
      const snippet = row.snippet ? row.snippet.replace(/\n/g, " ") : "";
      csv += [
        idx + 1,
        csvEscape(row.field),
        csvEscape(row.value),
        csvEscape(row.category),
        row.confidence?.toFixed(2) ?? "",
        csvEscape(snippet),
      ].join(",") + "\n";
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hr-requirement-fields.csv";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("CSV exported.");
  };

  const handleGenerateBrief = () => {
    if (!sortedRows.length) {
      setError("Extract fields first, then generate the HR brief.");
      return;
    }
    setError(null);
    setBriefCopied(false);

    const get = (name: string): string | undefined =>
      sortedRows.find((r) => r.field === name)?.value;

    const clientName = get("Client Name");
    const clientCompany = get("Client Company / Agency");
    const clientCity =
      get("Client Location / City") || get("Work Location") || undefined;
    const position = get("Position Title");
    const openings = get("Total Openings");
    const expYears = get("Experience Required (years)");
    const expLevel = get("Experience Level");
    const budgetRange = get("Budget Range (INR/month)");
    const workMode = get("Work Mode");
    const skills = get("Required Skills / Tech Stack");
    const notice = get("Notice Period / Joining Timeline");
    const contractType = get("Contract Type");
    const shift = get("Shift Timing");

    const lines: string[] = [];

    // Title line
    const titleRole = position || "Role";
    const titleLoc = clientCity ? ` (${clientCity})` : "";
    lines.push(`Hiring Requirement – ${titleRole}${titleLoc}`);
    lines.push("------------------------------------------------");
    lines.push("");

    if (clientName || clientCompany) {
      const parts = [clientName, clientCompany].filter(Boolean).join(" | ");
      lines.push(`Client: ${parts}`);
    }
    if (clientCity) {
      lines.push(`Location: ${clientCity}`);
    }
    if (openings) {
      lines.push(`Total Openings: ${openings}`);
    }
    if (expYears || expLevel) {
      const expParts = [
        expLevel,
        expYears ? `${expYears} years` : undefined,
      ].filter(Boolean);
      if (expParts.length) lines.push(`Experience: ${expParts.join(" · ")}`);
    }
    if (budgetRange) {
      lines.push(`Budget: ${budgetRange} (per month, approx.)`);
    }
    if (workMode) {
      lines.push(`Work Mode: ${workMode}`);
    }
    if (contractType) {
      lines.push(`Type: ${contractType}`);
    }
    if (shift) {
      lines.push(`Shift: ${shift}`);
    }

    if (skills) {
      lines.push("");
      lines.push(`Key skills / tech stack: ${skills}`);
    }

    lines.push("");
    lines.push("All captured details:");
    sortedRows.forEach((row) => {
      lines.push(`- ${row.field}: ${row.value}`);
    });

    const briefText = lines.join("\n");
    setHrBrief(briefText);
    setStatus("HR brief generated. You can copy it below.");
  };

  const handleCopyBrief = async () => {
    if (!hrBrief.trim()) return;
    try {
      await navigator.clipboard.writeText(hrBrief);
      setBriefCopied(true);
      setStatus("HR brief copied to clipboard.");
    } catch (e) {
      setError("Failed to copy HR brief.");
    }
  };

  const handleTabChange = (tab: TabId) => {
    if (isListening) return; // optional: disable switching while listening
    setActiveTab(tab);
  };

  const handleReset = () => {
    setTranscript("");
    setPiiRows([]);
    setError(null);
    setStatus("Idle");
    setActiveTab("transcript");
    setHrBrief("");
    setBriefCopied(false);
  };

  const isBusy = isListening || isExtracting;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Top heading + actions card */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shadow-lg shadow-emerald-500/10">
        <div className="space-y-1">
          <h1 className="text-lg sm:text-xl font-semibold">
            Capture hiring conversations
          </h1>
          <p className="text-[11px] sm:text-xs text-slate-300">
            Speak with clients or agencies. We&apos;ll turn it into a structured HR
            requirement table.
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-300 pt-1">
            <span className="text-slate-400">Language mode:</span>
            <select
              value={lang}
              onChange={(e) =>
                setLang(e.target.value as "hi-IN" | "en-IN" | "en-US")
              }
              disabled={isListening}
              className="rounded-md border border-slate-700 bg-slate-950/70 px-2 py-1 text-[11px] text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400/70"
            >
              <option value="hi-IN">Hinglish / Hindi (hi-IN)</option>
              <option value="en-IN">English (India - en-IN)</option>
              <option value="en-US">English (US - en-US)</option>
            </select>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2 py-[2px] text-[10px] text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Live speech
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={startListening}
            disabled={!isSupported || isListening}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 disabled:opacity-50"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-900 border border-emerald-300" />
            {isSupported ? "Start Listening" : "Not supported"}
          </button>
          <button
            onClick={stopListening}
            disabled={!isListening}
            className="inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
          >
            ⏹ Stop
          </button>
          <button
            onClick={handleReset}
            disabled={isBusy || (!transcript && !piiRows.length)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 border border-slate-700 disabled:opacity-50"
          >
            ↺ Clear
          </button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            isListening
              ? "bg-emerald-400 shadow-[0_0_0_4px] shadow-emerald-500/20"
              : isExtracting
              ? "bg-amber-400 shadow-[0_0_0_4px] shadow-amber-500/20"
              : "bg-slate-500"
          }`}
        />
        <span>{status}</span>
        {isExtracting && (
          <span className="text-[10px] text-slate-400">
            (Parsing roles, openings, budget, experience…)
          </span>
        )}
        {briefCopied && (
          <span className="text-[10px] text-emerald-300">
            HR brief copied ✔
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-300 border border-red-700/70 bg-red-950/50 rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Main card: tabs + content */}
      <div className="rounded-3xl border border-slate-800/90 bg-slate-950/70 backdrop-blur-xl shadow-xl shadow-black/40 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/80">
          <button
            onClick={() => handleTabChange("transcript")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "transcript"
                ? "bg-slate-900 text-emerald-300 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-100"
            }`}
          >
            Transcript
          </button>
          <button
            onClick={() => handleTabChange("pii")}
            className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
              activeTab === "pii"
                ? "bg-slate-900 text-emerald-300 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-100"
            }`}
            disabled={isListening}
          >
            HR fields table
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {activeTab === "transcript" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span>Conversation text (auto-filled or paste your own)</span>
                <span className="text-[10px] text-slate-500">
                  {transcript.length
                    ? `${transcript.length} characters`
                    : "empty"}
                </span>
              </div>

              <textarea
                className="w-full min-h-[190px] rounded-2xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-emerald-400/70 focus:border-emerald-400/90 resize-y"
                placeholder="Speak using mic or paste the HR conversation here (name, company, openings, role, experience, budget, etc.)…"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                readOnly={isListening}
              />

              <div className="flex flex-wrap gap-3 justify-between items-center">
                <button
                  onClick={() => handleExtractPII(false)}
                  disabled={!transcript.trim() || isBusy}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400 px-4 py-1.5 text-xs font-semibold text-slate-900 shadow-lg shadow-emerald-500/40 disabled:opacity-50"
                >
                  🔄 Sync &amp; extract HR fields
                </button>
                <p className="text-[10px] text-slate-500 max-w-xs text-right">
                  Tip: You can also paste Zoom/Meet recording transcript,
                  WhatsApp export, or notes from a phone call.
                </p>
              </div>
            </div>
          )}

          {activeTab === "pii" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-semibold text-slate-100">
                    Structured requirement fields
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Use this table to update your ATS, share with team, or send
                    back to client.
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyAsMarkdown}
                    disabled={!sortedRows.length || isBusy}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                  >
                    Copy as table
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={!sortedRows.length || isBusy}
                    className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                  <button
                    onClick={handleGenerateBrief}
                    disabled={!sortedRows.length || isBusy}
                    className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold text-slate-950 border border-emerald-400/80 disabled:opacity-50"
                  >
                    ✉ Generate HR brief
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800/80 rounded-2xl bg-slate-950/70">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800">
                    <tr>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        #
                      </th>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        Field
                      </th>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        Value
                      </th>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        Category
                      </th>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        Conf.
                      </th>
                      <th className="px-2 py-2 text-left text-slate-400 font-medium">
                        Snippet
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-5 text-center text-slate-500"
                        >
                          No HR fields detected yet. Extract using the
                          transcript tab.
                        </td>
                      </tr>
                    ) : (
                      sortedRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-slate-800/70 odd:bg-slate-950/70 even:bg-slate-950/40 hover:bg-slate-900/60 transition-colors"
                        >
                          <td className="px-2 py-2 align-top text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="px-2 py-2 align-top font-medium text-slate-100">
                            {row.field}
                          </td>
                          <td className="px-2 py-2 align-top text-slate-100">
                            {row.value}
                          </td>
                          <td className="px-2 py-2 align-top">
                            <span className={categoryBadgeClass(row.category)}>
                              {row.category || "—"}
                            </span>
                          </td>
                          <td className="px-2 py-2 align-top text-slate-300">
                            {row.confidence !== undefined
                              ? row.confidence.toFixed(2)
                              : ""}
                          </td>
                          <td className="px-2 py-2 align-top text-slate-400 max-w-[260px]">
                            <span className="line-clamp-3">
                              {row.snippet || "—"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* HR brief preview */}
              {hrBrief && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-xs font-semibold text-slate-100">
                        HR email / notes template
                      </h3>
                      <p className="text-[10px] text-slate-400">
                        Copy & paste directly into email, ATS, or your notes.
                      </p>
                    </div>
                    <button
                      onClick={handleCopyBrief}
                      disabled={!hrBrief.trim()}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                    >
                      Copy brief
                    </button>
                  </div>

                  <textarea
                    className="w-full min-h-[140px] rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 resize-y"
                    value={hrBrief}
                    readOnly
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        Privacy note: This is a prototype. For production, add consent screens,
        secure storage, and possibly self-hosted models instead of a 3rd party.
      </p>
    </div>
  );
}

// Helpers for escaping markdown/CSV
function escapeMd(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function csvEscape(text: string): string {
  if (text.includes(",") || text.includes('"') || text.includes("\n")) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function categoryBadgeClass(category: string): string {
  const base =
    "inline-flex items-center rounded-full border px-2 py-[2px] text-[10px] capitalize";
  switch (category?.toLowerCase()) {
    case "client":
      return `${base} bg-emerald-500/10 border-emerald-400/60 text-emerald-200`;
    case "role":
      return `${base} bg-cyan-500/10 border-cyan-400/60 text-cyan-200`;
    case "openings":
      return `${base} bg-indigo-500/10 border-indigo-400/60 text-indigo-200`;
    case "budget":
      return `${base} bg-amber-500/10 border-amber-400/60 text-amber-200`;
    case "location":
      return `${base} bg-fuchsia-500/10 border-fuchsia-400/60 text-fuchsia-200`;
    default:
      return `${base} bg-slate-700/40 border-slate-500/80 text-slate-100`;
  }
}
