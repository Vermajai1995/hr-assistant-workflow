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
  onresult:
    | ((this: SpeechRecognitionType, ev: SpeechRecognitionEvent) => any)
    | null;
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

// Small spinner component
function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-slate-300 border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
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

type ThemeOption = "dark" | "light" | "system";
type LoadingAction = null | "extract" | "transliterate";

// Sample transcript – ab ye extract ho sakta hai ✅
const SAMPLE_TRANSCRIPT =
  "उदाहरण (Hindi + English): मेरा नाम भोले राम है और मैं लखनऊ में रहता हूं और मुझे requirement यही है कि मुझे 7 आदमी चाहिए, वह भी सॉफ्टवेयर इंजीनियर with 4 years of experience और मेरा बजट है 7000 से 15000 रुपये per month.";

export default function CapturePage() {
  // Hydration fix
  const [mounted, setMounted] = useState(false);

  const [isSupported, setIsSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState<string>("Idle");

  const [transcript, setTranscript] = useState<string>(SAMPLE_TRANSCRIPT);

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

  // Transliteration state
  const [originalRows, setOriginalRows] = useState<PiiRowExt[] | null>(null);
  const [isTransliterated, setIsTransliterated] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<ThemeOption>("system");

  // Global loading state for overlay spinner
  const [loadingAction, setLoadingAction] = useState<LoadingAction>(null);

  const [whatsAppText, setWhatsAppText] = useState<string>("");

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);

  // file upload states
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileStatus, setFileStatus] = useState<string | null>(null);
  const stopExtractTimeoutRef = useRef<number | null>(null);
  const autoExtractedThisSessionRef = useRef(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setFileStatus("Reading file...");
    setTranscript("");

    try {
      // ---------- PDF ----------
      if (file.type === "application/pdf") {
        const pdfjsLib = await import("pdfjs-dist");
        const pdfAny: any = pdfjsLib;

        const v = pdfAny.version;
        const candidates = [
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.mjs`,
          `https://cdn.jsdelivr.net/npm/pdfjs-dist@${v}/build/pdf.worker.min.js`,
        ];
        pdfAny.GlobalWorkerOptions.workerSrc = candidates[0];

        const arrayBuffer = await file.arrayBuffer();
        const typedArray = new Uint8Array(arrayBuffer);

        const loadingTask = pdfAny.getDocument({ data: typedArray });
        const pdf = await loadingTask.promise;

        let fullText = "";
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const content = await page.getTextContent();
          const strings = (content.items as any[])
            .map((item) => (item as any).str || "")
            .join(" ");
          fullText += strings + "\n";
        }

        setTranscript(fullText.trim());
        setFileStatus("PDF parsed successfully ✅");
        return;
      }

      // ---------- DOCX ----------
      if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = await import("mammoth/mammoth.browser");
        const arrayBuffer = await file.arrayBuffer();
        const { value } = await mammoth.extractRawText({ arrayBuffer });

        setTranscript(value.trim());
        setFileStatus("DOCX parsed successfully ✅");
        return;
      }

      // ---------- TXT ----------
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text();
        setTranscript(text.trim());
        setFileStatus("Text file loaded ✅");
        return;
      }

      // ---------- fallback ----------
      const text = await file.text();
      setTranscript(text.trim());
      setFileStatus(
        "Unknown file type – attempted to read as text. Please review."
      );
    } catch (err) {
      console.error("File parse error:", err);
      setFileStatus("⚠️ Failed to parse file. Paste the text manually if needed.");
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Load saved theme
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem("theme");
      if (saved === "dark" || saved === "light" || saved === "system") {
        setTheme(saved);
      } else {
        setTheme("system");
      }
    } catch {
      // ignore
    }
  }, [mounted]);

  // Apply theme to <html data-theme="">
  useEffect(() => {
    if (!mounted) return;

    const prefersDark =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;

    let finalTheme: "light" | "dark" | "smart-dark" | "smart-light" = "dark";

    if (theme === "system") {
      finalTheme = prefersDark ? "smart-dark" : "smart-light";
    } else {
      finalTheme = theme;
    }

    document.documentElement.setAttribute("data-theme", finalTheme);

    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme, mounted]);

  // Sorted rows helpers
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
    if (!mounted) return;
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
  }, [lang, mounted]);

  const startListening = () => {
    if (!recognitionRef.current) return;

    autoExtractedThisSessionRef.current = false;

    if (stopExtractTimeoutRef.current) {
      window.clearTimeout(stopExtractTimeoutRef.current);
      stopExtractTimeoutRef.current = null;
    }

    // Fresh session: clear everything + transliteration cache
    setRows([]);
    setHrBrief("");
    setEmailDraft("");
    setJdText("");
    setOriginalRows(null);
    setIsTransliterated(false);
    setWhatsAppText("");
    setError(null);

    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch (e) {
      console.error(e);
      setError("Could not start microphone. Please check browser permissions.");
    }
  };

  const handleExtractPII = async (autoFromMic = false) => {
    if (isExtracting || loadingAction) return;

    const text = transcript.trim();

    // ✅ Only block if EMPTY (sample is allowed now)
    if (!text) {
      setError("Please speak something first or paste a conversation.");
      return;
    }

    setIsExtracting(true);
    setLoadingAction("extract");
    setError(null);
    setStatus(autoFromMic ? "Auto-extracting HR details…" : "Extracting structured HR details…");

    // Clear old summaries & transliteration state
    setHrBrief("");
    setEmailDraft("");
    setJdText("");
    setBriefCopied(false);
    setEmailCopied(false);
    setJsonCopied(false);
    setOriginalRows(null);
    setIsTransliterated(false);

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

      const sorted: PiiRowExt[] = sortRows(data.rows || []);
      setRows(sorted);
      setStatus(
        sorted.length
          ? `Found ${sorted.length} key fields for this requirement.`
          : "No useful fields found in this conversation."
      );
      setActiveTab("pii");

      // Auto-sync summaries with latest rows
      setHrBrief(buildHrBrief(sorted));
      setEmailDraft(buildEmailDraft(sorted));
      setJdText(buildJdText(sorted));
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unexpected error while extracting PII.");
      setStatus("Idle");
    } finally {
      setIsExtracting(false);
      setLoadingAction(null);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    // ✅ if already auto-extracted once, just stop mic
    if (autoExtractedThisSessionRef.current) {
      try {
        recognitionRef.current.stop();
        setStatus("Stopping…");
      } catch {}
      return;
    }

    // clear any previous timer
    if (stopExtractTimeoutRef.current) {
      window.clearTimeout(stopExtractTimeoutRef.current);
      stopExtractTimeoutRef.current = null;
    }

    try {
      recognitionRef.current.stop();
      setStatus("Stopping…");

      stopExtractTimeoutRef.current = window.setTimeout(() => {
        // ✅ run auto-extract only once per listening session
        if (autoExtractedThisSessionRef.current) return;
        if (!transcript.trim()) return;

        autoExtractedThisSessionRef.current = true;
        handleExtractPII(true);
      }, 500);
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateWhatsApp = () => {
    if (!rows.length) {
      setError("Extract fields first to generate WhatsApp summary.");
      return;
    }
    setError(null);

    const position = getFieldValue("Position Title") || "Software Engineer";
    const clientName = getFieldValue("Client Name");
    const clientCompany = getFieldValue("Client Company / Agency");
    const clientCity =
      getFieldValue("Client Location / City") ||
      getFieldValue("Work Location") ||
      "";
    const openings = getFieldValue("Total Openings");
    const expYears = getFieldValue("Experience Required (years)");
    const expLevel = getFieldValue("Experience Level");
    const budget = getFieldValue("Budget Range (INR/month)");
    const skills = getFieldValue("Required Skills / Tech Stack");
    const workMode = getFieldValue("Work Mode");

    const parts: string[] = [];

    if (clientName || clientCompany) {
      parts.push(
        `Client: ${[clientName, clientCompany].filter(Boolean).join(" | ")}`
      );
    }

    let firstLine = `Role: ${position}`;
    if (clientCity) firstLine += ` (${clientCity})`;
    parts.push(firstLine);

    if (openings) parts.push(`Openings: ${openings}`);
    if (expLevel || expYears) {
      const expParts = [expLevel, expYears ? `${expYears} yrs` : undefined].filter(
        Boolean
      );
      parts.push(`Exp: ${expParts.join(" · ")}`);
    }
    if (workMode) parts.push(`Mode: ${workMode}`);
    if (budget) parts.push(`Budget: ${budget}`);
    if (skills) parts.push(`Skills: ${skills}`);

    const msg =
      parts.join(" | ") +
      "\n\nIf this looks interesting, ping me and I’ll share full JD + next steps.";

    setWhatsAppText(msg);
    setStatus("WhatsApp summary generated.");
  };

  // Inline edit handler
  const handleValueChange = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  };

  // Transliteration: Hindi → English letters
  const handleTransliterate = async () => {
    try {
      if (isTransliterated) return; // Already done
      if (!rows.length) return;

      setLoadingAction("transliterate");
      setStatus("Converting values to English...");
      setError(null);

      // Save original rows only first time (current dataset)
      setOriginalRows(rows.map((r) => ({ ...r })));

      const values = rows.map((r) => r.value);

      const res = await fetch("/api/transliterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ values }),
      });

      const data = await res.json();
      if (!data.ok) throw new Error(data.error);

      const updated = data.result as string[];

      const updatedRows: PiiRowExt[] = rows.map((r, i) => ({
        ...r,
        value: updated[i] || r.value,
      }));

      setRows(updatedRows);
      setIsTransliterated(true);
      setStatus("Converted to English 🔤");

      // Keep summaries in sync after transliteration too
      setHrBrief(buildHrBrief(updatedRows));
      setEmailDraft(buildEmailDraft(updatedRows));
      setJdText(buildJdText(updatedRows));
    } catch (e: any) {
      setError(e.message || "Transliteration failed.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleUndoTransliterate = () => {
    try {
      if (!originalRows) return;

      const restored = originalRows.map((r) => ({ ...r }));
      setRows(restored);
      setIsTransliterated(false);
      setStatus("Restored original values ↩");

      // Rebuild summaries from original data
      setHrBrief(buildHrBrief(restored));
      setEmailDraft(buildEmailDraft(restored));
      setJdText(buildJdText(restored));
    } catch (e: any) {
      setError("Unable to undo.");
    }
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
      csv +=
        [
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

  // HR brief generator
  const handleGenerateBrief = () => {
    if (!rows.length) {
      setError("Extract fields first, then generate the HR brief.");
      return;
    }
    setError(null);
    setBriefCopied(false);
    setHrBrief(buildHrBrief(rows));
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
    setEmailDraft(buildEmailDraft(rows));
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

  // JD generator
  const handleGenerateJD = () => {
    if (!rows.length) {
      setError("Extract fields first to generate a job description.");
      return;
    }
    setError(null);
    setJdText(buildJdText(rows));
    setStatus("Short job description generated.");
  };

  const handleTabChange = (tab: TabId) => {
    if (isListening) return;
    setActiveTab(tab);
  };

  const handleReset = () => {
    setTranscript(SAMPLE_TRANSCRIPT);
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
    setOriginalRows(null);
    setIsTransliterated(false);
    setLoadingAction(null);
    setWhatsAppText("");
    setFileName(null);
    setFileStatus(null);
  };

  const isBusy = isListening || isExtracting || loadingAction !== null;

  // Hydration-safe
  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-xs text-muted">
        Loading interface…
      </div>
    );
  }

  // For overlay message
  const overlayMessage =
    loadingAction === "extract"
      ? "Extracting HR fields from conversation…"
      : loadingAction === "transliterate"
      ? "Converting Hindi text to English letters…"
      : isListening
      ? "Listening…"
      : "";

  return (
    <>
      <div className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        {/* Top heading + actions card */}
        <div className="ui-card2 rounded-2xl backdrop-blur-xl px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-semibold">
              Capture hiring conversations
            </h1>

            <p className="text-[11px] sm:text-xs text-muted">
              Speak with clients or agencies. We&apos;ll turn it into a structured HR requirement table.
            </p>

            <div className="flex items-center gap-2 text-[11px] pt-1 flex-wrap">
              <span className="text-muted">Language mode:</span>
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as "hi-IN" | "en-IN" | "en-US")
                }
                disabled={isListening}
                className="ui-select rounded-md px-2 py-1 text-[11px]"
              >
                <option value="hi-IN">Hinglish / Hindi (hi-IN)</option>
                <option value="en-IN">English (India - en-IN)</option>
                <option value="en-US">English (US - en-US)</option>
              </select>

              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[10px]"
                style={{
                  background: "rgba(16,185,129,0.10)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  color: "var(--tab-active-fg)",
                }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--tab-active-fg)" }}
                />
                Live speech
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            {/* Theme switcher */}
            <div className="flex items-center gap-2 text-[11px]">
              <span className="text-muted">Theme:</span>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeOption)}
                className="ui-select rounded-md px-2 py-1 text-[11px]"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">Smart</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <button
                onClick={startListening}
                disabled={!isSupported || isListening}
                className="ui-btn-primary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {isListening ? (
                  <Spinner size={12} />
                ) : (
                  <span
                    className="h-2 w-2 rounded-full border"
                    style={{
                      background: "rgba(5,46,43,0.85)",
                      borderColor: "rgba(255,255,255,0.35)",
                    }}
                  />
                )}
                {isSupported ? "Start Listening" : "Not supported"}
              </button>

              <button
                onClick={stopListening}
                disabled={!isListening}
                className="ui-btn-secondary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                ⏹ Stop
              </button>

              <button
                onClick={handleReset}
                disabled={isBusy || (!transcript && !rows.length)}
                className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                ↺ Clear
              </button>
            </div>
          </div>
        </div>

        {/* Status line */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span
            className="inline-flex h-2 w-2 rounded-full"
            style={{
              background: isListening
                ? "var(--tab-active-fg)"
                : isExtracting || loadingAction
                ? "rgba(245,158,11,0.9)"
                : "rgba(100,116,139,0.9)",
              boxShadow: isListening
                ? "0 0 0 4px rgba(16,185,129,0.15)"
                : isExtracting || loadingAction
                ? "0 0 0 4px rgba(245,158,11,0.15)"
                : "none",
            }}
          />
          <span>{status}</span>

          {isExtracting && (
            <span className="text-[10px] text-muted">
              (Parsing roles, openings, budget, experience…)
            </span>
          )}

          {briefCopied && (
            <span className="text-[10px]" style={{ color: "var(--tab-active-fg)" }}>
              HR brief copied ✔
            </span>
          )}
          {emailCopied && (
            <span className="text-[10px]" style={{ color: "var(--tab-active-fg)" }}>
              Email draft copied ✔
            </span>
          )}
          {jsonCopied && (
            <span className="text-[10px]" style={{ color: "var(--tab-active-fg)" }}>
              JSON copied ✔
            </span>
          )}
        </div>

        {error && <div className="ui-danger rounded-xl px-3 py-2 text-xs">{error}</div>}

        {/* Main card */}
        <div className="ui-card rounded-3xl backdrop-blur-xl shadow-xl overflow-hidden">
          {/* Tabs */}
          <div className="ui-tabbar flex">
            <button
              onClick={() => handleTabChange("transcript")}
              className="flex-1 px-4 py-2.5 text-xs font-medium transition-colors"
              style={
                activeTab === "transcript"
                  ? {
                      background: "var(--tab-active-bg)",
                      color: "var(--tab-active-fg)",
                      borderBottom: "2px solid var(--tab-active-fg)",
                    }
                  : { color: "var(--tab-inactive-fg)" }
              }
            >
              Transcript
            </button>

            <button
              onClick={() => handleTabChange("pii")}
              disabled={isListening}
              className="flex-1 px-4 py-2.5 text-xs font-medium transition-colors disabled:opacity-50"
              style={
                activeTab === "pii"
                  ? {
                      background: "var(--tab-active-bg)",
                      color: "var(--tab-active-fg)",
                      borderBottom: "2px solid var(--tab-active-fg)",
                    }
                  : { color: "var(--tab-inactive-fg)" }
              }
            >
              HR fields table
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6">
            {activeTab === "transcript" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs text-muted">
                  <span>Conversation text (auto-filled or paste your own)</span>
                  <span className="text-[10px] text-muted">
                    {transcript.length ? `${transcript.length} characters` : "empty"}
                  </span>
                </div>

                <div className="space-y-2">
                  <label className="text-xs text-muted">
                    Upload transcript / JD (PDF, DOCX, TXT)
                  </label>

                  <div className="flex items-center gap-3 flex-wrap">
                    <input
                      id="upload-transcript"
                      type="file"
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileChange}
                      className="hidden"
                    />

                    <label
                      htmlFor="upload-transcript"
                      className="ui-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold cursor-pointer select-none"
                    >
                      📄 Upload file
                      <span className="text-[10px] font-bold opacity-80">
                        PDF/DOCX/TXT
                      </span>
                    </label>

                    <span
                      className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px]"
                      title={fileName || "No file chosen"}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: "rgba(100,116,139,0.9)" }}
                      />
                      {fileName ? (
                        <span className="max-w-[220px] sm:max-w-[320px] truncate">
                          {fileName}
                        </span>
                      ) : (
                        <span className="text-muted">No file chosen</span>
                      )}
                    </span>
                  </div>

                  {fileName && (
                    <p className="text-[11px] text-muted">
                      Selected: <span className="font-medium">{fileName}</span>
                    </p>
                  )}

                  {fileStatus && (
                    <p
                      className="text-[11px] rounded-xl px-3 py-2 inline-block"
                      style={{
                        color: "var(--tab-active-fg)",
                        background: "rgba(16,185,129,0.10)",
                        border: "1px solid rgba(16,185,129,0.22)",
                      }}
                    >
                      {fileStatus}
                    </p>
                  )}

                  <p className="text-[10px] text-muted">
                    Tip: If parsing looks odd, you can edit the text below before extraction.
                  </p>
                </div>

                <textarea
                  className="ui-input w-full min-h-[190px] rounded-2xl px-3 py-2 text-sm resize-y"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  readOnly={isListening}
                />

                <div className="flex flex-wrap gap-3 justify-between items-center">
                  <button
                    onClick={() => handleExtractPII(false)}
                    disabled={!transcript.trim() || isBusy}
                    className="ui-btn-primary inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                  >
                    {loadingAction === "extract" ? <Spinner size={14} /> : <>🔄</>}
                    <span>Sync &amp; extract HR fields</span>
                  </button>

                  <p className="text-[10px] text-muted max-w-xs text-right">
                    Tip: You can paste Zoom/Meet transcript, WhatsApp export, or notes from a phone call.
                  </p>
                </div>
              </div>
            )}

            {activeTab === "pii" && (
              <div className="space-y-4">
                {/* Completeness bar */}
                <div className="flex flex-col gap-1 text-xs mb-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Field completeness:</span>
                      <span style={{ color: "var(--tab-active-fg)" }}>
                        {completeness.present} / {completeness.total} core fields
                      </span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {!isTransliterated ? (
                        <button
                          onClick={handleTransliterate}
                          disabled={!rows.length || isBusy}
                          className="ui-btn-secondary rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                        >
                          {loadingAction === "transliterate" ? (
                            <Spinner size={12} />
                          ) : (
                            "🌐"
                          )}{" "}
                          Convert to English
                        </button>
                      ) : (
                        <button
                          onClick={handleUndoTransliterate}
                          className="ui-btn-secondary rounded-full px-3 py-1.5 text-[11px] font-semibold"
                        >
                          ↩ Undo Transliteration
                        </button>
                      )}

                      <button
                        onClick={handleCopyAsMarkdown}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                      >
                        Copy table (MD)
                      </button>

                      <button
                        onClick={handleExportCSV}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                      >
                        Export CSV
                      </button>

                      <button
                        onClick={handleCopyJson}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        style={{ borderColor: "rgba(16,185,129,0.45)" }}
                      >
                        {jsonCopied ? "JSON copied" : "Copy JSON"}
                      </button>
                    </div>
                  </div>

                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ background: "rgba(148,163,184,0.15)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${completeness.percent}%`,
                        background: "var(--btn-primary-bg)",
                      }}
                    />
                  </div>

                  {completeness.missing.length > 0 && (
                    <div className="text-[10px] text-muted">
                      Missing core fields:{" "}
                      <span style={{ color: "rgba(245,158,11,0.95)" }}>
                        {completeness.missing.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* Table */}
                <div className="ui-table-wrap overflow-x-auto rounded-2xl">
                  <table className="min-w-full text-[11px]">
                    <thead className="ui-thead">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted">#</th>
                        <th className="px-2 py-2 text-left font-medium text-muted">Field</th>
                        <th className="px-2 py-2 text-left font-medium text-muted">Value (editable)</th>
                        <th className="px-2 py-2 text-left font-medium text-muted">Category</th>
                        <th className="px-2 py-2 text-left font-medium text-muted">Conf.</th>
                        <th className="px-2 py-2 text-left font-medium text-muted">Snippet</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-3 py-5 text-center text-muted">
                            No HR fields detected yet. Extract using the transcript tab.
                          </td>
                        </tr>
                      ) : (
                        rows.map((row, idx) => {
                          const sensitive = isSensitiveRow(row);
                          const isLowConf =
                            row.confidence !== undefined && row.confidence < 0.6;

                          return (
                            <tr
                              key={row.id}
                              className={`border-t ui-row-hover ${
                                idx % 2 === 0 ? "ui-row-odd" : "ui-row-even"
                              } ${sensitive ? "ui-danger" : ""}`}
                              style={{ borderColor: "var(--border)" }}
                            >
                              <td className="px-2 py-2 align-top text-muted">
                                {idx + 1}
                              </td>

                              <td className="px-2 py-2 align-top font-medium">
                                <div className="flex items-center gap-1">
                                  {row.field}
                                  {sensitive && (
                                    <span className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px]"
                                      style={{
                                        background: "rgba(239,68,68,0.10)",
                                        border: "1px solid rgba(239,68,68,0.35)",
                                      }}
                                    >
                                      ⚠ Sensitive
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="px-2 py-2 align-top">
                                <input
                                  className="ui-input w-full rounded-md px-2 py-[3px] text-[11px]"
                                  value={row.value}
                                  onChange={(e) => handleValueChange(row.id, e)}
                                />
                              </td>

                              <td className="px-2 py-2 align-top">
                                <span className={categoryBadgeClass(row.category)}>
                                  {row.category || "—"}
                                </span>

                                {isLowConf && (
                                  <span
                                    className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px]"
                                    style={{
                                      background: "rgba(245,158,11,0.10)",
                                      border: "1px solid rgba(245,158,11,0.35)",
                                      color: "rgba(245,158,11,0.95)",
                                    }}
                                  >
                                    ⬇ Low conf
                                  </span>
                                )}
                              </td>

                              <td className="px-2 py-2 align-top text-muted">
                                {row.confidence !== undefined ? row.confidence.toFixed(2) : ""}
                              </td>

                              <td className="px-2 py-2 align-top text-muted max-w-[260px]">
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

                {/* Summaries */}
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="space-y-1">
                      <h3 className="text-xs font-semibold">Summaries & templates</h3>
                      <p className="text-[10px] text-muted">
                        Update table values if needed, then generate clean text blocks.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={handleGenerateBrief}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size={12} /> : "📝 HR brief"}
                      </button>

                      <button
                        onClick={handleGenerateEmail}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size={12} /> : "✉ Email draft"}
                      </button>

                      <button
                        onClick={handleGenerateJD}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      >
                        {isBusy ? <Spinner size={12} /> : "📄 Short JD"}
                      </button>

                      <button
                        onClick={handleGenerateWhatsApp}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-primary rounded-full px-3 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                      >
                         {isBusy ? <Spinner size={12} /> : "📱 WhatsApp summary"}
                      </button>
                    </div>
                  </div>

                  {hrBrief && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">HR brief (internal notes)</h4>
                        <button
                          onClick={handleCopyBrief}
                          disabled={!hrBrief.trim()}
                          className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        >
                          Copy brief
                        </button>
                      </div>
                      <textarea
                        className="ui-input w-full min-h-[120px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={hrBrief}
                        readOnly
                      />
                    </div>
                  )}

                  {emailDraft && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">Email draft for client confirmation</h4>
                        <button
                          onClick={handleCopyEmail}
                          disabled={!emailDraft.trim()}
                          className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        >
                          Copy email
                        </button>
                      </div>
                      <textarea
                        className="ui-input w-full min-h-[120px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={emailDraft}
                        readOnly
                      />
                    </div>
                  )}

                  {jdText && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold">Short job description</h4>
                      <textarea
                        className="ui-input w-full min-h-[120px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={jdText}
                        readOnly
                      />
                    </div>
                  )}

                  {whatsAppText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">WhatsApp summary (copy & send)</h4>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(whatsAppText);
                              setStatus("WhatsApp summary copied.");
                            } catch {
                              setError("Failed to copy WhatsApp text.");
                            }
                          }}
                          className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium"
                        >
                          Copy text
                        </button>
                      </div>

                      <textarea
                        className="ui-input w-full min-h-[80px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={whatsAppText}
                        readOnly
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] text-muted">
          Privacy note: This is a prototype. For production, add consent screens, secure storage,
          and possibly self-hosted models instead of a 3rd party.
        </p>
      </div>

      {/* Full-screen overlay loader */}
      {(loadingAction || isExtracting) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Spinner size={40} />
          {overlayMessage && <p className="mt-3 text-xs text-slate-100">{overlayMessage}</p>}
        </div>
      )}
    </>
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
      return `${base} bg-emerald-500/10 border-emerald-400/40 text-emerald-200`;
    case "role":
      return `${base} bg-cyan-500/10 border-cyan-400/40 text-cyan-200`;
    case "openings":
      return `${base} bg-indigo-500/10 border-indigo-400/40 text-indigo-200`;
    case "budget":
      return `${base} bg-amber-500/10 border-amber-400/40 text-amber-200`;
    case "location":
      return `${base} bg-fuchsia-500/10 border-fuchsia-400/40 text-fuchsia-200`;
    default:
      return `${base} bg-slate-500/10 border-slate-500/30 text-slate-200`;
  }
}

// very rough sensitive pattern detection
function isSensitiveRow(row: PiiRow): boolean {
  const value = row.value || "";
  const field = row.field.toLowerCase();

  const aadhaarLike = /\b\d{4}\s?\d{4}\s?\d{4}\b/.test(value);
  const panLike = /\b[A-Z]{5}\d{4}[A-Z]\b/i.test(value);
  const longDigits = /\b\d{10,}\b/.test(value);

  if (aadhaarLike || panLike || longDigits) return true;
  if (field.includes("aadhaar") || field.includes("pan") || field.includes("id"))
    return true;

  return false;
}

// ---------- summary builders ----------

function getFieldFromRows(rows: PiiRowExt[], name: string): string | undefined {
  return rows.find((r) => r.field === name)?.value;
}

function buildHrBrief(rows: PiiRowExt[]): string {
  if (!rows.length) return "";

  const clientName = getFieldFromRows(rows, "Client Name");
  const clientCompany = getFieldFromRows(rows, "Client Company / Agency");
  const clientCity =
    getFieldFromRows(rows, "Client Location / City") ||
    getFieldFromRows(rows, "Work Location") ||
    undefined;
  const position = getFieldFromRows(rows, "Position Title");
  const openings = getFieldFromRows(rows, "Total Openings");
  const expYears = getFieldFromRows(rows, "Experience Required (years)");
  const expLevel = getFieldFromRows(rows, "Experience Level");
  const budgetRange = getFieldFromRows(rows, "Budget Range (INR/month)");
  const workMode = getFieldFromRows(rows, "Work Mode");
  const skills = getFieldFromRows(rows, "Required Skills / Tech Stack");
  const notice = getFieldFromRows(rows, "Notice Period / Joining Timeline");
  const contractType = getFieldFromRows(rows, "Contract Type");
  const shift = getFieldFromRows(rows, "Shift Timing");

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
  if (clientCity) lines.push(`Location: ${clientCity}`);
  if (openings) lines.push(`Total Openings: ${openings}`);

  if (expYears || expLevel) {
    const expParts = [expLevel, expYears ? `${expYears} years` : undefined].filter(Boolean);
    if (expParts.length) lines.push(`Experience: ${expParts.join(" · ")}`);
  }

  if (budgetRange) lines.push(`Budget: ${budgetRange} (per month, approx.)`);
  if (workMode) lines.push(`Work Mode: ${workMode}`);
  if (contractType) lines.push(`Type: ${contractType}`);
  if (shift) lines.push(`Shift: ${shift}`);
  if (notice) lines.push(`Notice / Joining: ${notice}`);

  if (skills) {
    lines.push("");
    lines.push(`Key skills / tech stack: ${skills}`);
  }

  lines.push("");
  lines.push("All captured fields:");
  rows.forEach((row) => lines.push(`- ${row.field}: ${row.value}`));

  return lines.join("\n");
}

function buildEmailDraft(rows: PiiRowExt[]): string {
  if (!rows.length) return "";

  const clientName = getFieldFromRows(rows, "Client Name") || "there";
  const clientCompany = getFieldFromRows(rows, "Client Company / Agency") || "";
  const position = getFieldFromRows(rows, "Position Title") || "the role";
  const clientCity =
    getFieldFromRows(rows, "Client Location / City") ||
    getFieldFromRows(rows, "Work Location") ||
    "";
  const openings = getFieldFromRows(rows, "Total Openings");
  const expYears = getFieldFromRows(rows, "Experience Required (years)");
  const expLevel = getFieldFromRows(rows, "Experience Level");
  const budgetRange = getFieldFromRows(rows, "Budget Range (INR/month)");
  const workMode = getFieldFromRows(rows, "Work Mode");

  const subjectRole = position;
  const subjectLoc = clientCity ? ` – ${clientCity}` : "";
  const subject = `Requirement summary – ${subjectRole}${subjectLoc}`;

  const summaryLines: string[] = [];
  if (position) summaryLines.push(`• Position: ${position}`);
  if (openings) summaryLines.push(`• Openings: ${openings}`);
  if (clientCity) summaryLines.push(`• Location: ${clientCity}`);
  if (workMode) summaryLines.push(`• Work mode: ${workMode}`);

  if (expLevel || expYears) {
    const expParts = [expLevel, expYears ? `${expYears} years` : undefined].filter(Boolean);
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
    clientCompany,
  ].join("\n");

  return `Subject: ${subject}\n\n${emailBody}`;
}

function buildJdText(rows: PiiRowExt[]): string {
  if (!rows.length) return "";

  const position = getFieldFromRows(rows, "Position Title") || "Software Engineer";
  const clientCity =
    getFieldFromRows(rows, "Client Location / City") ||
    getFieldFromRows(rows, "Work Location") ||
    "";
  const openings = getFieldFromRows(rows, "Total Openings");
  const expYears = getFieldFromRows(rows, "Experience Required (years)");
  const budgetRange = getFieldFromRows(rows, "Budget Range (INR/month)");
  const workMode = getFieldFromRows(rows, "Work Mode");
  const skills = getFieldFromRows(rows, "Required Skills / Tech Stack");

  const lines: string[] = [];

  lines.push(`${position} – Job Description`);
  lines.push("--------------------------------");
  lines.push("");
  lines.push(
    `We are hiring${openings ? ` ${openings}` : ""} ${position}${
      clientCity ? ` for our client based in ${clientCity}` : ""
    }.`
  );

  if (expYears) lines.push(`Experience required: around ${expYears} years.`);
  if (workMode) lines.push(`Work mode: ${workMode}.`);
  if (budgetRange) lines.push(`Budget range (per month): ${budgetRange}.`);

  if (skills) {
    lines.push("");
    lines.push("Key skills:");
    lines.push(`- ${skills}`);
  }

  lines.push("");
  lines.push("Responsibilities (high-level):");
  lines.push("- Work closely with the team to deliver assigned tasks.");
  lines.push("- Ensure quality, reliability and timely completion of project work.");
  lines.push("- Collaborate with stakeholders and communicate progress regularly.");

  lines.push("");
  lines.push("Nice to have:");
  lines.push("- Strong communication and ownership mindset.");
  lines.push("- Ability to work independently with minimal supervision.");

  return lines.join("\n");
}
