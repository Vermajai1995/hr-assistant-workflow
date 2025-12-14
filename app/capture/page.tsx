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

type ToastType = "success" | "error" | "info";

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
  const [emailDraft, setEmailDraft] = useState<string>("");
  const [jdText, setJdText] = useState<string>("");

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
  const stopExtractTimeoutRef = useRef<number | null>(null);
  const autoExtractedThisSessionRef = useRef(false);

  // Toast (snackbar)
  const [toast, setToast] = useState<{ msg: string; type: ToastType } | null>(
    null
  );
  const toastTimerRef = useRef<number | null>(null);

  const showToast = (msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setFileName(file.name);
    setTranscript("");

    showToast("Reading file…", "info");

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
        showToast("PDF parsed ✅", "success");
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
        showToast("DOCX parsed ✅", "success");
        return;
      }

      // ---------- TXT ----------
      if (file.type === "text/plain" || file.name.endsWith(".txt")) {
        const text = await file.text();
        setTranscript(text.trim());
        showToast("Text loaded ✅", "success");
        return;
      }

      // ---------- fallback ----------
      const text = await file.text();
      setTranscript(text.trim());
      showToast("Read as text (unknown type) ⚠️", "info");
    } catch (err) {
      console.error("File parse error:", err);
      showToast("Failed to parse file ⚠️", "error");
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
      showToast("Mic permission issue", "error");
    }
  };

  const handleExtractPII = async (autoFromMic = false) => {
    if (isExtracting || loadingAction) return;

    const text = transcript.trim();

    if (!text) {
      setError("Please speak something first or paste a conversation.");
      showToast("Add some transcript first", "info");
      return;
    }

    setIsExtracting(true);
    setLoadingAction("extract");
    setError(null);
    setStatus(
      autoFromMic
        ? "Auto-extracting HR details…"
        : "Extracting structured HR details…"
    );

    // Clear old summaries & transliteration state
    setHrBrief("");
    setEmailDraft("");
    setJdText("");
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

      showToast(`Extracted ${sorted.length} fields ✅`, "success");
    } catch (err: any) {
      console.error(err);
      setError(err?.message || "Unexpected error while extracting PII.");
      setStatus("Idle");
      showToast("Extraction failed ⚠️", "error");
    } finally {
      setIsExtracting(false);
      setLoadingAction(null);
    }
  };

  const stopListening = () => {
    if (!recognitionRef.current) return;

    if (autoExtractedThisSessionRef.current) {
      try {
        recognitionRef.current.stop();
        setStatus("Stopping…");
      } catch {}
      return;
    }

    if (stopExtractTimeoutRef.current) {
      window.clearTimeout(stopExtractTimeoutRef.current);
      stopExtractTimeoutRef.current = null;
    }

    try {
      recognitionRef.current.stop();
      setStatus("Stopping…");

      stopExtractTimeoutRef.current = window.setTimeout(() => {
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
      showToast("Extract fields first", "info");
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
      const expParts = [
        expLevel,
        expYears ? `${expYears} yrs` : undefined,
      ].filter(Boolean);
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
    showToast("WhatsApp summary ready ✅", "success");
  };

  // Inline edit handler
  const handleValueChange = (id: string, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, value } : r)));
  };

  // Transliteration: Hindi → English letters
  const handleTransliterate = async () => {
    try {
      if (isTransliterated) return;
      if (!rows.length) return;

      setLoadingAction("transliterate");
      setStatus("Converting values to English...");
      setError(null);

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

      setHrBrief(buildHrBrief(updatedRows));
      setEmailDraft(buildEmailDraft(updatedRows));
      setJdText(buildJdText(updatedRows));

      showToast("Converted to English 🔤", "success");
    } catch (e: any) {
      setError(e.message || "Transliteration failed.");
      showToast("Transliteration failed ⚠️", "error");
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

      setHrBrief(buildHrBrief(restored));
      setEmailDraft(buildEmailDraft(restored));
      setJdText(buildJdText(restored));

      showToast("Restored original ↩", "info");
    } catch {
      setError("Unable to undo.");
      showToast("Undo failed", "error");
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
      showToast("Table copied (Markdown) ✔", "success");
    } catch {
      setError("Failed to copy table to clipboard.");
      showToast("Copy failed", "error");
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

    showToast("CSV exported ✅", "success");
  };

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
      showToast("JSON copied ✔", "success");
    } catch {
      setError("Failed to copy JSON.");
      showToast("Copy failed", "error");
    }
  };

  const handleGenerateBrief = () => {
    if (!rows.length) {
      setError("Extract fields first, then generate the HR brief.");
      showToast("Extract fields first", "info");
      return;
    }
    setError(null);
    setHrBrief(buildHrBrief(rows));
    setStatus("HR brief generated.");
    showToast("HR brief generated ✅", "success");
  };

  const handleCopyBrief = async () => {
    if (!hrBrief.trim()) return;
    try {
      await navigator.clipboard.writeText(hrBrief);
      showToast("HR brief copied ✔", "success");
    } catch {
      setError("Failed to copy HR brief.");
      showToast("Copy failed", "error");
    }
  };

  const handleGenerateEmail = () => {
    if (!rows.length) {
      setError("Extract fields first to generate email.");
      showToast("Extract fields first", "info");
      return;
    }
    setError(null);
    setEmailDraft(buildEmailDraft(rows));
    setStatus("Email draft generated.");
    showToast("Email draft generated ✅", "success");
  };

  const handleCopyEmail = async () => {
    if (!emailDraft.trim()) return;
    try {
      await navigator.clipboard.writeText(emailDraft);
      showToast("Email draft copied ✔", "success");
    } catch {
      setError("Failed to copy email draft.");
      showToast("Copy failed", "error");
    }
  };

  const handleGenerateJD = () => {
    if (!rows.length) {
      setError("Extract fields first to generate a job description.");
      showToast("Extract fields first", "info");
      return;
    }
    setError(null);
    setJdText(buildJdText(rows));
    setStatus("Short job description generated.");
    showToast("Short JD generated ✅", "success");
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
    setOriginalRows(null);
    setIsTransliterated(false);
    setLoadingAction(null);
    setWhatsAppText("");
    setFileName(null);

    showToast("Cleared", "info");
  };

  const isBusy = isListening || isExtracting || loadingAction !== null;

  if (!mounted) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-xs text-muted">
        Loading interface…
      </div>
    );
  }

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
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        {/* Compact Top card */}
        <div className="ui-card2 rounded-2xl backdrop-blur-xl px-4 py-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-semibold">
                  Capture hiring conversations
                </h1>

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
                  Live
                </span>
              </div>

              <p className="text-[11px] text-muted mt-0.5">
                Speak with clients/agencies → structured HR requirement table.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <select
                value={lang}
                onChange={(e) =>
                  setLang(e.target.value as "hi-IN" | "en-IN" | "en-US")
                }
                disabled={isListening}
                className="ui-select rounded-md px-2 py-1 text-[11px]"
                title="Language mode"
              >
                <option value="hi-IN">Hinglish (hi-IN)</option>
                <option value="en-IN">English (en-IN)</option>
                <option value="en-US">English (en-US)</option>
              </select>

              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value as ThemeOption)}
                className="ui-select rounded-md px-2 py-1 text-[11px]"
                title="Theme"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">Smart</option>
              </select>

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
                {isSupported ? "Start" : "No mic"}
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

        {/* Status line (clean) */}
        <div className="flex items-center gap-2 text-[11px] flex-wrap">
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
        </div>

        {error && (
          <div className="ui-danger rounded-xl px-3 py-2 text-xs">{error}</div>
        )}

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
              HR fields
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-5">
            {activeTab === "transcript" && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs text-muted">
                  <span>Conversation text (auto-filled or paste your own)</span>
                  <span className="text-[10px]">
                    {transcript.length ? `${transcript.length} chars` : "empty"}
                  </span>
                </div>

                {/* Compact upload row */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    id="upload-transcript"
                    type="file"
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <label
                    htmlFor="upload-transcript"
                    className="ui-btn-primary inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold cursor-pointer select-none"
                    title="Upload PDF/DOCX/TXT"
                  >
                    📄 Upload
                    <span className="text-[10px] font-bold opacity-80">
                      PDF/DOCX/TXT
                    </span>
                  </label>

                  <span
                    className="ui-btn-ghost inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] max-w-full"
                    title={fileName || "No file chosen"}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: "rgba(100,116,139,0.9)" }}
                    />
                    <span className="max-w-[240px] sm:max-w-[360px] truncate">
                      {fileName || "No file chosen"}
                    </span>
                  </span>

                  {fileName && (
                    <button
                      type="button"
                      className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px]"
                      onClick={() => {
                        setFileName(null);
                        showToast("File cleared", "info");
                      }}
                      title="Clear selected file"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <textarea
                  className="ui-input w-full min-h-[150px] rounded-2xl px-3 py-2 text-sm resize-y"
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
                    {loadingAction === "extract" ? (
                      <Spinner size={14} />
                    ) : (
                      <>🔄</>
                    )}
                    <span>Sync &amp; extract HR fields</span>
                  </button>

                  <p className="text-[10px] text-muted max-w-xs text-right hidden sm:block">
                    Tip: You can paste Zoom/Meet transcript, WhatsApp export, or
                    notes from a phone call.
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
                      <span className="font-semibold">Completeness:</span>
                      <span style={{ color: "var(--tab-active-fg)" }}>
                        {completeness.present} / {completeness.total}
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
                          ↩ Undo
                        </button>
                      )}

                      <button
                        onClick={handleCopyAsMarkdown}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                      >
                        Copy MD
                      </button>

                      <button
                        onClick={handleExportCSV}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                      >
                        CSV
                      </button>

                      <button
                        onClick={handleCopyJson}
                        disabled={!rows.length || isBusy}
                        className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        style={{ borderColor: "rgba(16,185,129,0.45)" }}
                      >
                        JSON
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
                      Missing:{" "}
                      <span style={{ color: "rgba(245,158,11,0.95)" }}>
                        {completeness.missing.join(", ")}
                      </span>
                    </div>
                  )}
                </div>

                {/* ✅ MOBILE CARDS */}
                <div className="sm:hidden space-y-2">
                  {rows.length === 0 ? (
                    <div className="ui-card2 rounded-2xl px-3 py-3 text-[11px] text-muted">
                      No HR fields detected yet. Extract using the transcript tab.
                    </div>
                  ) : (
                    rows.map((row, idx) => {
                      const sensitive = isSensitiveRow(row);
                      const isLowConf =
                        row.confidence !== undefined && row.confidence < 0.6;

                      return (
                        <div
                          key={row.id}
                          className={`rounded-2xl border px-3 py-3 ${
                            sensitive ? "ui-danger" : "ui-card2"
                          }`}
                          style={{ borderColor: "var(--border)" }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] text-muted">
                                  #{idx + 1}
                                </span>
                                <span className="text-xs font-semibold">
                                  {row.field}
                                </span>

                                {sensitive && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px]"
                                    style={{
                                      background: "rgba(239,68,68,0.10)",
                                      border: "1px solid rgba(239,68,68,0.35)",
                                    }}
                                  >
                                    ⚠ Sensitive
                                  </span>
                                )}
                              </div>

                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <span className={categoryBadgeClass(row.category)}>
                                  {row.category || "—"}
                                </span>

                                {isLowConf && (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full px-2 py-[2px] text-[9px]"
                                    style={{
                                      background: "rgba(245,158,11,0.10)",
                                      border: "1px solid rgba(245,158,11,0.35)",
                                      color: "rgba(245,158,11,0.95)",
                                    }}
                                  >
                                    ⬇ Low conf
                                  </span>
                                )}

                                {row.confidence !== undefined && (
                                  <span className="text-[10px] text-muted">
                                    Conf: {row.confidence.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2">
                            <label className="text-[10px] text-muted">
                              Value (editable)
                            </label>
                            <input
                              className="ui-input w-full rounded-xl px-3 py-2 text-[12px] mt-1"
                              value={row.value}
                              onChange={(e) => handleValueChange(row.id, e)}
                            />
                          </div>

                          <div className="mt-2">
                            <label className="text-[10px] text-muted">
                              Snippet
                            </label>
                            <div className="mt-1 text-[11px] text-muted">
                              {row.snippet ? (
                                <div className="line-clamp-3">{row.snippet}</div>
                              ) : (
                                "—"
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* ✅ DESKTOP TABLE */}
                <div className="hidden sm:block ui-table-wrap overflow-x-auto rounded-2xl">
                  <table className="min-w-full text-[11px]">
                    <thead className="ui-thead">
                      <tr>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          #
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          Field
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          Value (editable)
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          Category
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          Conf.
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-muted">
                          Snippet
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={6}
                            className="px-3 py-5 text-center text-muted"
                          >
                            No HR fields detected yet. Extract using the transcript
                            tab.
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
                                    <span
                                      className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-[1px] text-[9px]"
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
                                {row.confidence !== undefined
                                  ? row.confidence.toFixed(2)
                                  : ""}
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
                <div className="mt-3 space-y-4">
                  <div className="flex flex-wrap gap-2 justify-between items-center">
                    <div className="space-y-0.5">
                      <h3 className="text-xs font-semibold">
                        Summaries & templates
                      </h3>
                      <p className="text-[10px] text-muted">
                        Edit values → generate clean text blocks.
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
                        {isBusy ? <Spinner size={12} /> : "📱 WhatsApp"}
                      </button>
                    </div>
                  </div>

                  {hrBrief && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">
                          HR brief (internal notes)
                        </h4>
                        <button
                          onClick={handleCopyBrief}
                          disabled={!hrBrief.trim()}
                          className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        >
                          Copy brief
                        </button>
                      </div>
                      <textarea
                        className="ui-input w-full min-h-[110px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={hrBrief}
                        readOnly
                      />
                    </div>
                  )}

                  {emailDraft && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">
                          Email draft for client confirmation
                        </h4>
                        <button
                          onClick={handleCopyEmail}
                          disabled={!emailDraft.trim()}
                          className="ui-btn-ghost rounded-full px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                        >
                          Copy email
                        </button>
                      </div>
                      <textarea
                        className="ui-input w-full min-h-[110px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={emailDraft}
                        readOnly
                      />
                    </div>
                  )}

                  {jdText && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold">
                        Short job description
                      </h4>
                      <textarea
                        className="ui-input w-full min-h-[110px] rounded-2xl px-3 py-2 text-[11px] resize-y"
                        value={jdText}
                        readOnly
                      />
                    </div>
                  )}

                  {whatsAppText && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold">
                          WhatsApp summary (copy & send)
                        </h4>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(whatsAppText);
                              showToast("WhatsApp copied ✔", "success");
                            } catch {
                              setError("Failed to copy WhatsApp text.");
                              showToast("Copy failed", "error");
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
          Privacy note: This is a prototype. For production, add consent screens,
          secure storage, and possibly self-hosted models instead of a 3rd party.
        </p>
      </div>

      {/* Toast (auto hide) */}
      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60]">
          <div
            className="rounded-full px-4 py-2 text-xs border backdrop-blur-xl shadow-lg"
            style={{
              background:
                toast.type === "error"
                  ? "rgba(239,68,68,0.15)"
                  : toast.type === "info"
                  ? "rgba(148,163,184,0.15)"
                  : "rgba(16,185,129,0.12)",
              borderColor:
                toast.type === "error"
                  ? "rgba(239,68,68,0.35)"
                  : toast.type === "info"
                  ? "rgba(148,163,184,0.30)"
                  : "rgba(16,185,129,0.30)",
              color:
                toast.type === "error"
                  ? "rgba(254,202,202,0.95)"
                  : "var(--fg)",
            }}
          >
            {toast.msg}
          </div>
        </div>
      )}

      {/* Full-screen overlay loader */}
      {(loadingAction || isExtracting) && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <Spinner size={40} />
          {overlayMessage && (
            <p className="mt-3 text-xs text-slate-100">{overlayMessage}</p>
          )}
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
    const expParts = [
      expLevel,
      expYears ? `${expYears} years` : undefined,
    ].filter(Boolean);
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
