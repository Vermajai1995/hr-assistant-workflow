// app/capture/page.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";

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

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

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
    setPiiRows([]); // clear previous
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
      // Thoda delay so transcript settle ho jaye, phir auto extract
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
    setStatus("Extracting PII…");

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
          ? `Found ${data.rows.length} PII items.`
          : "No PII found in this conversation."
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
    if (!piiRows.length) return;

    const header =
      "| # | Field | Value | Category | Confidence | Snippet |\n" +
      "|---|-------|-------|----------|------------|---------|\n";

    const rowsStr = piiRows
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
    if (!piiRows.length) return;

    let csv = "Index,Field,Value,Category,Confidence,Snippet\n";

    piiRows.forEach((row, idx) => {
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
    link.download = "pii-data.csv";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("CSV exported.");
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
  };

  const isBusy = isListening || isExtracting;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
      {/* Top controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Capture conversation</h1>
          <p className="text-xs text-slate-400">
            Start listening or paste an existing chat / call transcript.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <span className="text-slate-500">Language mode:</span>
            <select
              value={lang}
              onChange={(e) =>
                setLang(e.target.value as "hi-IN" | "en-IN" | "en-US")
              }
              disabled={isListening}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-100"
            >
              <option value="hi-IN">Hinglish / Hindi (hi-IN)</option>
              <option value="en-IN">English (India - en-IN)</option>
              <option value="en-US">English (US - en-US)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            onClick={startListening}
            disabled={!isSupported || isListening}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-900 shadow shadow-emerald-500/40 disabled:opacity-50"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-900 border border-emerald-300" />
            Start Listening
          </button>
          <button
            onClick={stopListening}
            disabled={!isListening}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
          >
            ⏹ Stop
          </button>
          <button
            onClick={handleReset}
            disabled={isBusy || (!transcript && !piiRows.length)}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 border border-slate-700 disabled:opacity-50"
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Status line */}
      <div className="text-xs text-slate-400 flex items-center gap-2">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            isListening
              ? "bg-emerald-400"
              : isExtracting
              ? "bg-amber-400"
              : "bg-slate-500"
          }`}
        />
        <span>{status}</span>
        {isExtracting && (
          <span className="text-[10px] text-slate-500">
            (PII extraction in progress…)
          </span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 border border-red-700/60 bg-red-950/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {/* Tabs + content */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg shadow-black/40 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60">
          <button
            onClick={() => handleTabChange("transcript")}
            className={`flex-1 px-4 py-2 text-xs font-medium ${
              activeTab === "transcript"
                ? "bg-slate-900 text-emerald-300 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Transcript
          </button>
          <button
            onClick={() => handleTabChange("pii")}
            className={`flex-1 px-4 py-2 text-xs font-medium ${
              activeTab === "pii"
                ? "bg-slate-900 text-emerald-300 border-b-2 border-emerald-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
            disabled={isListening}
          >
            PII Table
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6">
          {activeTab === "transcript" && (
            <div className="space-y-3">
              <label className="flex justify-between items-center text-xs text-slate-400">
                <span>Conversation text (auto-filled or paste your own)</span>
                <span className="text-[10px]">
                  {transcript.length
                    ? `${transcript.length} characters`
                    : "empty"}
                </span>
              </label>
              <textarea
                className="w-full min-h-[180px] rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:ring-1 focus:ring-emerald-500/70 focus:border-emerald-500/90 resize-y"
                placeholder="Speak using mic or paste any conversation here..."
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                readOnly={isListening}
              />

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <button
                  onClick={() => handleExtractPII(false)}
                  disabled={!transcript.trim() || isBusy}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-medium text-slate-900 shadow shadow-emerald-500/40 disabled:opacity-50"
                >
                  🔄 Sync &amp; Extract PII
                </button>
                <p className="text-[10px] text-slate-500">
                  Tip: You can paste Zoom/Meet chat, WhatsApp export, call
                  transcript, etc.
                </p>
              </div>
            </div>
          )}

          {activeTab === "pii" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <h2 className="text-sm font-medium">Detected PII</h2>
                  <p className="text-[11px] text-slate-400">
                    {piiRows.length
                      ? "Review carefully before sharing or storing."
                      : "No PII detected yet. Try syncing a transcript."}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={handleCopyAsMarkdown}
                    disabled={!piiRows.length || isBusy}
                    className="rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                  >
                    Copy as table
                  </button>
                  <button
                    onClick={handleExportCSV}
                    disabled={!piiRows.length || isBusy}
                    className="rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                  >
                    Export CSV
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="min-w-full text-[11px]">
                  <thead className="bg-slate-900/80 border-b border-slate-800">
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
                    {piiRows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-3 py-4 text-center text-slate-500"
                        >
                          No PII rows yet. Extract using the transcript tab.
                        </td>
                      </tr>
                    ) : (
                      piiRows.map((row, idx) => (
                        <tr
                          key={idx}
                          className="border-t border-slate-800/80 hover:bg-slate-900/60"
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
                          <td className="px-2 py-2 align-top text-slate-300">
                            {row.category}
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
