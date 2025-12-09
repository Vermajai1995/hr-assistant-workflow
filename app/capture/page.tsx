// app/capture/page.tsx
"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  ChangeEvent,
} from "react";

type PiiRow = {
  field: string;
  value: string;
  category: string;
  confidence: number;
  snippet?: string;
};

type PiiRowExt = PiiRow & { id: string };

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

// Core fields for completeness bar
const CORE_FIELDS: string[] = [
  "Client Name",
  "Client Company / Agency",
  "Client Location / City",
  "Position Title",
  "Total Openings",
  "Experience Required (years)",
  "Experience Level",
  "Budget Range (INR/month)",
  "Work Mode",
];

export default function CapturePage() {
  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("Idle");
  const [transcript, setTranscript] = useState<string>("");
  const [rows, setRows] = useState<PiiRowExt[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("transcript");
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<"hi-IN" | "en-IN" | "en-US">("hi-IN");
  const [hrBrief, setHrBrief] = useState<string>("");
  const [briefCopied, setBriefCopied] = useState(false);
  const [emailDraft, setEmailDraft] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");
  const [jsonCopied, setJsonCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // Helpers
  const sortRows = (raw: PiiRow[]): PiiRowExt[] => {
    const withId: PiiRowExt[] = raw.map((r, i) => ({
      ...r,
      id: `${i}-${r.field}-${r.category}`,
    }));

    return withId.sort((a, b) => {
      const aIdx = FIELD_ORDER.indexOf(a.field);
      const bIdx = FIELD_ORDER.indexOf(b.field);
      const aScore = aIdx === -1 ? FIELD_ORDER.length + 1 : aIdx;
      const bScore = bIdx === -1 ? FIELD_ORDER.length + 1 : bIdx;
      if (aScore === bScore) return 0;
      return aScore - bScore;
    });
  };

  const getFieldValue = (name: string): string | undefined =>
    rows.find((r) => r.field === name)?.value;

  // Completeness info
  const completeness = useMemo(() => {
    if (!rows.length) {
      return {
        total: CORE_FIELDS.length,
        present: 0,
        missing: CORE_FIELDS,
        percent: 0,
      };
    }
    const presentSet = new Set(
      rows.map((r) => r.field).filter((f) => CORE_FIELDS.includes(f))
    );
    const present = presentSet.size;
    const missing = CORE_FIELDS.filter((f) => !presentSet.has(f));
    const percent = Math.round((present / CORE_FIELDS.length) * 100);
    return { total: CORE_FIELDS.length, present, missing, percent };
  }, [rows]);

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
  }, [lang, isListening]);

  const startListening = () => {
    if (!recognitionRef.current) return;
    setRows([]);
    setHrBrief("");
    setEmailDraft("");
    setJdText("");
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
    setEmailDraft("");
    setJdText("");
    setBriefCopied(false);
    setEmailCopied(false);
    setJsonCopied(false);

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

      const sorted = sortRows(data.rows || []);
      setRows(sorted);
      setStatus(
        sorted.length
          ? `Found ${sorted.length} key fields for this requirement.`
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

  // Inline edit handler
  const handleValueChange = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, value } : r))
    );
  };

  const handleCopyAsMarkdown = async () => {
    if (!rows.length) return;

    const header =
      "| # | Field | Value | Category | Confidence | Snippet |\n" +
      "|---|-------|-------|----------|------------|---------|\n";

    const rowsStr = rows
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
    if (!rows.length) return;

    let csv = "Index,Field,Value,Category,Confidence,Snippet\n";

    rows.forEach((row, idx) => {
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

  // JSON export (copy to clipboard)
  const handleCopyJson = async () => {
    if (!rows.length) return;

    const jsonObj: any = {
      clientName: getFieldValue("Client Name") || null,
      clientCompany: getFieldValue("Client Company / Agency") || null,
      clientCity: getFieldValue("Client Location / City") || null,
      workLocation: getFieldValue("Work Location") || null,
      positionTitle: getFieldValue("Position Title") || null,
      totalOpenings: getFieldValue("Total Openings") || null,
      experienceYears: getFieldValue("Experience Required (years)") || null,
      experienceLevel: getFieldValue("Experience Level") || null,
      workMode: getFieldValue("Work Mode") || null,
      skills: getFieldValue("Required Skills / Tech Stack") || null,
      budgetRangeInrPerMonth: getFieldValue("Budget Range (INR/month)") || null,
      minBudgetInrPerMonth: getFieldValue("Minimum Budget (INR/month)") || null,
      maxBudgetInrPerMonth: getFieldValue("Maximum Budget (INR/month)") || null,
      noticePeriod: getFieldValue("Notice Period / Joining Timeline") || null,
      contractType: getFieldValue("Contract Type") || null,
      shiftTiming: getFieldValue("Shift Timing") || null,
      otherNotes: getFieldValue("Other Notes") || null,
      rawRows: rows.map(({ id, ...rest }) => rest),
    };

    try {
      await navigator.clipboard.writeText(JSON.stringify(jsonObj, null, 2));
      setJsonCopied(true);
      setStatus("JSON copied to clipboard.");
    } catch (e) {
      setError("Failed to copy JSON.");
    }
  };

  // HR brief generator (uses edited data)
  const handleGenerateBrief = () => {
    if (!rows.length) {
      setError("Extract fields first, then generate the HR brief.");
      return;
    }
    setError(null);
    setBriefCopied(false);

    const clientName = getFieldValue("Client Name");
    const clientCompany = getFieldValue("Client Company / Agency");
    const clientCity =
      getFieldValue("Client Location / City") ||
      getFieldValue("Work Location") ||
      undefined;
    const position = getFieldValue("Position Title");
    const openings = getFieldValue("Total Openings");
    const expYears = getFieldValue("Experience Required (years)");
    const expLevel = getFieldValue("Experience Level");
    const budgetRange = getFieldValue("Budget Range (INR/month)");
    const workMode = getFieldValue("Work Mode");
    const skills = getFieldValue("Required Skills / Tech Stack");
    const notice = getFieldValue("Notice Period / Joining Timeline");
    const contractType = getFieldValue("Contract Type");
    const shift = getFieldValue("Shift Timing");

    const lines: string[] = [];

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
    if (notice) {
      lines.push(`Notice / Joining: ${notice}`);
    }

    if (skills) {
      lines.push("");
      lines.push(`Key skills / tech stack: ${skills}`);
    }

    lines.push("");
    lines.push("All captured fields:");
    rows.forEach((row) => {
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

  // Email draft generator
  const handleGenerateEmail = () => {
    if (!rows.length) {
      setError("Extract fields first to generate email.");
      return;
    }
    setError(null);
    setEmailCopied(false);

    const clientName = getFieldValue("Client Name") || "there";
    const clientCompany = getFieldValue("Client Company / Agency");
    const position = getFieldValue("Position Title") || "the role";
    const clientCity =
      getFieldValue("Client Location / City") ||
      getFieldValue("Work Location") ||
      "";
    const openings = getFieldValue("Total Openings");
    const expYears = getFieldValue("Experience Required (years)");
    const expLevel = getFieldValue("Experience Level");
    const budgetRange = getFieldValue("Budget Range (INR/month)");
    const workMode = getFieldValue("Work Mode");

    const subjectRole = position;
    const subjectLoc = clientCity ? ` – ${clientCity}` : "";
    const subject = `Requirement summary – ${subjectRole}${subjectLoc}`;

    const summaryLines: string[] = [];
    if (position) summaryLines.push(`• Position: ${position}`);
    if (openings) summaryLines.push(`• Openings: ${openings}`);
    if (clientCity) summaryLines.push(`• Location: ${clientCity}`);
    if (workMode) summaryLines.push(`• Work mode: ${workMode}`);
    if (expLevel || expYears) {
      const expParts = [
        expLevel,
        expYears ? `${expYears} years` : undefined,
      ].filter(Boolean);
      summaryLines.push(`• Experience: ${expParts.join(" · ")}`);
    }
    if (budgetRange) summaryLines.push(`• Budget: ${budgetRange}`);

    const emailBody = [
      `Hi ${clientName},`,
      "",
      "Thank you for sharing the hiring requirement.",
      "Here is the summary based on our conversation:",
      "",
      ...summaryLines,
      "",
      "If anything looks off or needs correction (openings, budget, experience, etc.),",
      "please reply with the updated details and we will adjust it on our side.",
      "",
      "Regards,",
      "HR Team",
      clientCompany || "",
    ].join("\n");

    const fullDraft = `Subject: ${subject}\n\n${emailBody}`;
    setEmailDraft(fullDraft);
    setStatus("Email draft generated.");
  };

  const handleCopyEmail = async () => {
    if (!emailDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(emailDraft);
      setEmailCopied(true);
      setStatus("Email draft copied to clipboard.");
    } catch (e) {
      setError("Failed to copy email draft.");
    }
  };

  // JD generator (short job description)
  const handleGenerateJD = () => {
    if (!rows.length) {
      setError("Extract fields first to generate a job description.");
      return;
    }
    setError(null);

    const position = getFieldValue("Position Title") || "Software Engineer";
    const clientCompany =
      getFieldValue("Client Company / Agency") || "our client";
    const clientCity =
      getFieldValue("Client Location / City") ||
      getFieldValue("Work Location") ||
      "";
    const openings = getFieldValue("Total Openings");
    const expYears = getFieldValue("Experience Required (years)");
    const budgetRange = getFieldValue("Budget Range (INR/month)");
    const workMode = getFieldValue("Work Mode");
    const skills = getFieldValue("Required Skills / Tech Stack");

    const lines: string[] = [];

    lines.push(`${position} – Job Description`);
    lines.push("--------------------------------");
    lines.push("");
    lines.push(
      `We are hiring${openings ? ` ${openings}` : ""} ${position}${
        clientCity ? ` for our client based in ${clientCity}` : ""
      }.`
    );

    if (expYears) {
      lines.push(`Experience required: around ${expYears} years.`);
    }

    if (workMode) {
      lines.push(`Work mode: ${workMode}.`);
    }

    if (budgetRange) {
      lines.push(`Budget range (per month): ${budgetRange}.`);
    }

    if (skills) {
      lines.push("");
      lines.push("Key skills:");
      lines.push(`- ${skills}`);
    }

    lines.push("");
    lines.push("Responsibilities (high-level):");
    lines.push("- Work closely with the team to deliver assigned tasks.");
    lines.push(
      "- Ensure quality, reliability and timely completion of project work."
    );
    lines.push(
      "- Collaborate with stakeholders and communicate progress regularly."
    );

    lines.push("");
    lines.push("Nice to have:");
    lines.push("- Strong communication and ownership mindset.");
    lines.push("- Ability to work independently with minimal supervision.");

    const jd = lines.join("\n");
    setJdText(jd);
    setStatus("Short job description generated.");
  };

  const handleTabChange = (tab: TabId) => {
    if (isListening) return;
    setActiveTab(tab);
  };

  const handleReset = () => {
    setTranscript("");
    setRows([]);
    setError(null);
    setStatus("Idle");
    setActiveTab("transcript");
    setHrBrief("");
    setEmailDraft("");
    setJdText("");
    setBriefCopied(false);
    setEmailCopied(false);
    setJsonCopied(false);
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
            disabled={isBusy || (!transcript && !rows.length)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-200 border border-slate-700 disabled:opacity-50"
          >
            ↺ Clear
          </button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 text-xs text-slate-200 flex-wrap">
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
        {emailCopied && (
          <span className="text-[10px] text-emerald-300">
            Email draft copied ✔
          </span>
        )}
        {jsonCopied && (
          <span className="text-[10px] text-emerald-300">
            JSON copied ✔
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
                  Tip: You can also paste Zoom/Meet transcript, WhatsApp export,
                  or notes from a phone call.
                </p>
              </div>
            </div>
          )}

          {activeTab === "pii" && (
            <div className="space-y-4">
              {/* Completeness bar */}
              <div className="flex flex-col gap-1 text-xs text-slate-200 mb-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">
                      Field completeness:
                    </span>
                    <span className="text-emerald-300">
                      {completeness.present} / {completeness.total} core
                      fields
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={handleCopyAsMarkdown}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                    >
                      Copy table (MD)
                    </button>
                    <button
                      onClick={handleExportCSV}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                    >
                      Export CSV
                    </button>
                    <button
                      onClick={handleCopyJson}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-emerald-500/60 disabled:opacity-50"
                    >
                      {jsonCopied ? "JSON copied" : "Copy JSON"}
                    </button>
                  </div>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                    style={{ width: `${completeness.percent}%` }}
                  />
                </div>
                {completeness.missing.length > 0 && (
                  <div className="text-[10px] text-slate-400">
                    Missing core fields:{" "}
                    <span className="text-amber-300">
                      {completeness.missing.join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Table */}
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
                        Value (editable)
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
                    {rows.length === 0 ? (
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
                      rows.map((row, idx) => {
                        const sensitive = isSensitiveRow(row);
                        return (
                          <tr
                            key={row.id}
                            className={`border-t border-slate-800/70 odd:bg-slate-950/70 even:bg-slate-950/40 hover:bg-slate-900/60 transition-colors ${
                              sensitive ? "bg-red-950/40" : ""
                            }`}
                          >
                            <td className="px-2 py-2 align-top text-slate-500">
                              {idx + 1}
                            </td>
                            <td className="px-2 py-2 align-top font-medium text-slate-100">
                              <div className="flex items-center gap-1">
                                {row.field}
                                {sensitive && (
                                  <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-400/60 px-1.5 py-[1px] text-[9px] text-red-200">
                                    ⚠ Sensitive
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 align-top text-slate-100">
                              <input
                                className="w-full rounded-md border border-slate-700 bg-slate-950/80 px-1 py-[3px] text-[11px] text-slate-100 outline-none focus:ring-1 focus:ring-emerald-400/70 focus:border-emerald-400/80"
                                value={row.value}
                                onChange={(e) =>
                                  handleValueChange(row.id, e)
                                }
                              />
                            </td>
                            <td className="px-2 py-2 align-top">
                              <span
                                className={categoryBadgeClass(row.category)}
                              >
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* HR brief + email + JD */}
              <div className="mt-4 space-y-4">
                {/* Brief + email buttons */}
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="space-y-1">
                    <h3 className="text-xs font-semibold text-slate-100">
                      Summaries & templates
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Update table values if needed, then generate clean text
                      blocks.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={handleGenerateBrief}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold text-slate-950 border border-emerald-400/80 disabled:opacity-50"
                    >
                      📝 HR brief
                    </button>
                    <button
                      onClick={handleGenerateEmail}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-sky-500/90 px-3 py-1.5 text-[11px] font-semibold text-slate-950 border border-sky-400/80 disabled:opacity-50"
                    >
                      ✉ Email draft
                    </button>
                    <button
                      onClick={handleGenerateJD}
                      disabled={!rows.length || isBusy}
                      className="rounded-full bg-indigo-500/90 px-3 py-1.5 text-[11px] font-semibold text-slate-50 border border-indigo-400/80 disabled:opacity-50"
                    >
                      📄 Short JD
                    </button>
                  </div>
                </div>

                {/* HR brief */}
                {hrBrief && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">
                          HR brief (internal notes)
                        </h4>
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
                      className="w-full min-h-[120px] rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 resize-y"
                      value={hrBrief}
                      readOnly
                    />
                  </div>
                )}

                {/* Email draft */}
                {emailDraft && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">
                          Email draft for client confirmation
                        </h4>
                      </div>
                      <button
                        onClick={handleCopyEmail}
                        disabled={!emailDraft.trim()}
                        className="rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-100 border border-slate-700 disabled:opacity-50"
                      >
                        Copy email
                      </button>
                    </div>
                    <textarea
                      className="w-full min-h-[120px] rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 resize-y"
                      value={emailDraft}
                      readOnly
                    />
                  </div>
                )}

                {/* JD text */}
                {jdText && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <h4 className="text-xs font-semibold text-slate-100">
                          Short job description
                        </h4>
                      </div>
                      {/* reuse brief copy button if needed manually */}
                    </div>
                    <textarea
                      className="w-full min-h-[120px] rounded-2xl border border-slate-700 bg-slate-950/90 px-3 py-2 text-[11px] text-slate-100 resize-y"
                      value={jdText}
                      readOnly
                    />
                  </div>
                )}
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

// --------- helpers ----------

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

// very rough sensitive pattern detection
function isSensitiveRow(row: PiiRow): boolean {
  const value = row.value || "";
  const field = row.field.toLowerCase();

  // Aadhaar-like 12 digits
  const aadhaarLike = /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(value);
  // PAN-like pattern
  const panLike = /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(value);
  // Long pure digit sequences (potential account/card)
  const longDigits = /\b\d{10,}\b/.test(value);

  if (aadhaarLike || panLike || longDigits) return true;
  if (field.includes("aadhaar") || field.includes("pan") || field.includes("id"))
    return true;

  return false;
}
