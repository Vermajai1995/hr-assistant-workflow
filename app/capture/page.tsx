"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import {
  buildSessionTitle,
  CORE_FIELD_LABELS,
  createCustomField,
  getEnabledFields,
  mergeFieldConfigs,
  PREDEFINED_FIELDS,
  sortRows,
} from "@/lib/hireflow/fields";
import {
  buildEmailDraft,
  buildHrBrief,
  buildJdText,
  buildWhatsAppText,
  csvEscape,
  escapeMd,
  getCompleteness,
} from "@/lib/hireflow/output";
import type {
  ExtractResponse,
  ExtractedFieldRow,
  ExtractionFieldConfig,
  GeneratedOutputs,
  SessionSnapshot,
} from "@/types/hireflow";

type TabId = "capture" | "review";
type OutputTabId = "fields" | "brief" | "email" | "jd" | "whatsapp";
type ToastTone = "success" | "error" | "info";

type SpeechRecognitionEvent = Event & {
  results: {
    [index: number]: {
      0: {
        transcript: string;
      };
    };
    length: number;
  };
};

type SpeechRecognitionType = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onstart: ((this: SpeechRecognitionType, ev: Event) => unknown) | null;
  onerror: ((this: SpeechRecognitionType, ev: { error?: string }) => unknown) | null;
  onend: ((this: SpeechRecognitionType, ev: Event) => unknown) | null;
  onresult:
    | ((this: SpeechRecognitionType, ev: SpeechRecognitionEvent) => unknown)
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

const SAMPLE_TRANSCRIPT =
  "Need 4 React developers for a fintech client in Pune. Budget is 18 to 24 lakh fixed, hybrid model, immediate joiners preferred, and the team wants strong TypeScript and Next.js experience.";

const STORAGE_KEY = "hireflow:sessions:v2";
const MAX_RECENT_SESSIONS = 8;

const EMPTY_OUTPUTS: GeneratedOutputs = {
  brief: "",
  email: "",
  jd: "",
  whatsapp: "",
};

export default function CapturePage() {
  const [mounted, setMounted] = useState(false);
  const [tab, setTab] = useState<TabId>("capture");
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [rows, setRows] = useState<ExtractedFieldRow[]>([]);
  const [selectedFields, setSelectedFields] = useState<ExtractionFieldConfig[]>(
    PREDEFINED_FIELDS
  );
  const [suggestedFields, setSuggestedFields] = useState<ExtractionFieldConfig[]>(
    []
  );
  const [outputs, setOutputs] = useState<GeneratedOutputs>(EMPTY_OUTPUTS);
  const [warnings, setWarnings] = useState<ExtractResponse["warnings"]>([]);
  const [status, setStatus] = useState("Ready to capture a hiring requirement.");
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [lang, setLang] = useState<"hi-IN" | "en-IN" | "en-US">("hi-IN");
  const [customFieldName, setCustomFieldName] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [isSharing, setIsSharing] = useState(false);
  const [recentSessions, setRecentSessions] = useState<SessionSnapshot[]>([]);
  const [fileName, setFileName] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: ToastTone } | null>(
    null
  );
  const [outputTab, setOutputTab] = useState<OutputTabId>("fields");

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const enabledFields = useMemo(
    () => getEnabledFields(selectedFields),
    [selectedFields]
  );
  const completeness = useMemo(
    () => getCompleteness(rows, CORE_FIELD_LABELS),
    [rows]
  );

  useEffect(() => {
    setMounted(true);
    setSessionId(createSessionId());
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    showToast("By using this tool, you consent to processing the input data.", "info");
  }, [mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as SessionSnapshot[];
      if (Array.isArray(parsed)) {
        setRecentSessions(parsed);
      }
    } catch {
      setRecentSessions([]);
    }
  }, [mounted]);

  useEffect(() => {
    if (!mounted || !rows.length) {
      return;
    }

    setOutputs({
      brief: buildHrBrief(rows),
      email: buildEmailDraft(rows),
      jd: buildJdText(rows),
      whatsapp: buildWhatsAppText(rows),
    });
  }, [rows, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
      setStatus("Listening for the hiring conversation...");
      setError(null);
    };

    recognition.onresult = (event) => {
      let value = "";
      for (let index = 0; index < event.results.length; index += 1) {
        value += `${event.results[index][0].transcript} `;
      }
      setTranscript(value.trim());
    };

    recognition.onerror = (event) => {
      setError(
        event.error === "not-allowed"
          ? "Microphone access was denied. Please allow mic permissions and try again."
          : `Speech recognition error: ${event.error || "unknown"}`
      );
      setStatus("Microphone capture failed.");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatus("Microphone stopped.");
    };

    recognitionRef.current = recognition;
    setIsSupported(true);

    return () => {
      try {
        recognition.stop();
      } catch {
        // no-op
      }
    };
  }, [lang, mounted]);

  useEffect(() => {
    if (!mounted) {
      return;
    }

    if (!transcript.trim() && !rows.length) {
      return;
    }

    const snapshot = buildSnapshot({
      sessionId,
      transcript,
      rows,
      selectedFields,
      suggestedFields,
      outputs,
      warnings,
      consentAccepted,
      shareUrl,
    });

    const nextSessions = [
      snapshot,
      ...recentSessions.filter((session) => session.id !== snapshot.id),
    ].slice(0, MAX_RECENT_SESSIONS);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextSessions));
      setRecentSessions(nextSessions);
    } catch {
      // ignore localStorage failures
    }
  }, [
    mounted,
    transcript,
    rows,
    selectedFields,
    suggestedFields,
    outputs,
    warnings,
    consentAccepted,
    shareUrl,
    sessionId,
  ]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showToast(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }

  async function handleExtract() {
    if (!consentAccepted) {
      setError("Please confirm consent before processing hiring data.");
      return;
    }

    if (!transcript.trim()) {
      setError("Add a transcript, file, or live voice capture before extracting.");
      return;
    }

    setIsExtracting(true);
    setError(null);
    setStatus("Extracting fields, suggested attributes, and polished outputs...");

    try {
      const response = await fetch("/api/extract-pii", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: transcript,
          selectedFields,
          consentAccepted,
        }),
      });

      const data = (await response.json()) as ExtractResponse & { error?: string };

      if (!response.ok) {
        throw new Error(data.error || "Extraction failed.");
      }

      const nextRows = sortRows(data.rows);
      setRows(nextRows);
      setSuggestedFields(mergeFieldConfigs([], data.suggestedFields));
      setWarnings(data.warnings);
      setOutputs(data.outputs);
      setStatus(data.extractionSummary);
      setTab("review");
      setOutputTab("fields");
      showToast(`Extracted ${nextRows.length} fields`, "success");
    } catch (extractError) {
      setError(
        extractError instanceof Error
          ? extractError.message
          : "Unexpected extraction failure."
      );
      setStatus("Extraction did not complete.");
      showToast("Extraction failed", "error");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleTransliterate() {
    if (!rows.length) {
      return;
    }

    setIsExtracting(true);
    setStatus("Transliterating extracted values into clean English text...");

    try {
      const response = await fetch("/api/transliterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          values: rows.map((row) => row.value),
        }),
      });

      const data = (await response.json()) as {
        ok: boolean;
        result?: string[];
        error?: string;
      };

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Transliteration failed.");
      }

      const nextRows = rows.map((row, index) => ({
        ...row,
        value: data.result?.[index] || row.value,
      }));

      setRows(nextRows);
      setStatus("Converted extracted values into clean English text.");
      showToast("Converted values to English", "success");
    } catch (transliterateError) {
      setError(
        transliterateError instanceof Error
          ? transliterateError.message
          : "Unexpected transliteration failure."
      );
      showToast("Transliteration failed", "error");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleShare() {
    if (!rows.length) {
      setError("Extract at least one session before generating a share link.");
      return;
    }

    setIsSharing(true);
    setError(null);

    try {
      const snapshot = buildSnapshot({
        sessionId,
        transcript,
        rows,
        selectedFields,
        suggestedFields,
        outputs,
        warnings,
        consentAccepted,
        shareUrl,
      });

      const response = await fetch("/api/sessions/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot }),
      });

      const data = (await response.json()) as {
        shareId?: string;
        shareUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.shareUrl) {
        throw new Error(data.error || "Share link generation failed.");
      }

      setShareUrl(data.shareUrl);
      await navigator.clipboard.writeText(data.shareUrl);
      setStatus("Created a read-only share link and copied it to your clipboard.");
      showToast("Share link copied", "success");
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : "Could not create a share link."
      );
      showToast("Share failed", "error");
    } finally {
      setIsSharing(false);
    }
  }

  function handleStartListening() {
    if (!consentAccepted) {
      setError("Please confirm recording consent before using the microphone.");
      return;
    }

    if (!recognitionRef.current) {
      setError("Speech recognition is not available in this browser.");
      return;
    }

    setRows([]);
    setWarnings([]);
    setOutputs(EMPTY_OUTPUTS);
    setShareUrl("");
    setTab("capture");

    try {
      recognitionRef.current.lang = lang;
      recognitionRef.current.start();
    } catch {
      setError("Unable to start the microphone. Please retry in Chrome.");
    }
  }

  function handleStopListening() {
    try {
      recognitionRef.current?.stop();
    } catch {
      // ignore
    }
  }

  function handleRowValueChange(id: string | undefined, value: string) {
    setRows((currentRows) =>
      currentRows.map((row) => (row.id === id ? { ...row, value } : row))
    );
  }

  function handleFieldToggle(key: string) {
    setSelectedFields((currentFields) =>
      currentFields.map((field) =>
        field.key === key ? { ...field, enabled: !field.enabled } : field
      )
    );
  }

  function handleAddCustomField() {
    const name = customFieldName.trim();
    if (!name) {
      return;
    }

    const customField = createCustomField(name);
    setSelectedFields((currentFields) => mergeFieldConfigs(currentFields, [customField]));
    setCustomFieldName("");
    showToast(`Added "${name}"`, "success");
  }

  function handleAcceptSuggestedField(field: ExtractionFieldConfig) {
    const enabledField = { ...field, enabled: true };
    setSelectedFields((currentFields) => mergeFieldConfigs(currentFields, [enabledField]));
    setSuggestedFields((currentFields) =>
      currentFields.filter((item) => item.key !== field.key)
    );
    showToast(`Added "${field.label}" to selected fields`, "success");
  }

  function handleRestoreSession(snapshot: SessionSnapshot) {
    setSessionId(snapshot.id);
    setTranscript(snapshot.transcript);
    setRows(snapshot.rows);
    setSelectedFields(snapshot.selectedFields);
    setSuggestedFields(snapshot.suggestedFields);
    setOutputs(snapshot.outputs);
    setWarnings(snapshot.warnings);
    setConsentAccepted(snapshot.consentAccepted);
    setShareUrl(snapshot.shareUrl || "");
    setStatus(`Loaded session from ${formatDate(snapshot.updatedAt)}.`);
    setTab(snapshot.rows.length ? "review" : "capture");
    setError(null);
  }

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setFileName(file.name);
    setStatus(`Parsing ${file.name}...`);
    setError(null);

    try {
      if (file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist");
        const pdfModule = pdfjs as unknown as {
          getDocument: (options: { data: Uint8Array }) => { promise: Promise<any> };
          GlobalWorkerOptions: { workerSrc: string };
          version: string;
        };

        pdfModule.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfModule.version}/build/pdf.worker.min.mjs`;

        const buffer = await file.arrayBuffer();
        const pdf = await pdfModule.getDocument({ data: new Uint8Array(buffer) }).promise;
        let parsedText = "";

        for (let page = 1; page <= pdf.numPages; page += 1) {
          const pdfPage = await pdf.getPage(page);
          const content = await pdfPage.getTextContent();
          parsedText += `${(content.items as Array<{ str?: string }>).map((item) => item.str || "").join(" ")}\n`;
        }

        setTranscript(parsedText.trim());
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = await import("mammoth/mammoth.browser");
        const result = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer(),
        });
        setTranscript(result.value.trim());
      } else {
        setTranscript((await file.text()).trim());
      }

      showToast(`Loaded ${file.name}`, "success");
      setTab("capture");
      setRows([]);
    } catch {
      setError(`Failed to parse ${file.name}. Try TXT, DOCX, or a cleaner PDF.`);
      showToast("File parsing failed", "error");
    }
  }

  function handleReset() {
    setSessionId(createSessionId());
    setTranscript(SAMPLE_TRANSCRIPT);
    setRows([]);
    setSuggestedFields([]);
    setWarnings([]);
    setOutputs(EMPTY_OUTPUTS);
    setConsentAccepted(false);
    setShareUrl("");
    setStatus("Started a fresh session.");
    setError(null);
    setTab("capture");
    setFileName("");
  }

  async function copyText(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      showToast(`${label} copied`, "success");
    } catch {
      setError(`Could not copy ${label.toLowerCase()}.`);
      showToast("Clipboard failed", "error");
    }
  }

  function copyMarkdownTable() {
    const header =
      "| # | Field | Value | Category | Confidence | Snippet |\n|---|---|---|---|---|---|\n";
    const body = rows
      .map(
        (row, index) =>
          `| ${index + 1} | ${escapeMd(row.field)} | ${escapeMd(row.value)} | ${escapeMd(
            row.category
          )} | ${row.confidence.toFixed(2)} | ${escapeMd(row.snippet || "")} |`
      )
      .join("\n");
    void copyText(`${header}${body}`, "Markdown table");
  }

  function exportCsv() {
    const csv =
      "Index,Field,Value,Category,Confidence,Snippet\n" +
      rows
        .map(
          (row, index) =>
            [
              index + 1,
              csvEscape(row.field),
              csvEscape(row.value),
              csvEscape(row.category),
              row.confidence.toFixed(2),
              csvEscape(row.snippet || ""),
            ].join(",")
        )
        .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hireflow-session.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
  }

  const groupedFields = groupFields(selectedFields);

  if (!mounted) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-sm text-muted">Loading HireFlow...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <section className="workspace-shell fade-in">
        <div className="workspace-heading">
          <div>
            <p className="eyebrow">Recruiter workspace</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-balance text-slate-900">
              Clean hiring capture, review, and output generation in one screen.
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
              Capture a call, paste notes, or upload a requirement file. Review extracted fields on the right and move between recruiter-ready outputs without scrolling through a long page.
            </p>
          </div>

          <div className="workspace-steps" aria-label="workflow overview">
            <span className={`step-pill ${tab === "capture" ? "active" : ""}`}>1. Capture</span>
            <span className={`step-pill ${tab === "review" ? "active" : ""}`}>2. Review fields</span>
            <span className={`step-pill ${rows.length ? "active" : ""}`}>3. Generate outputs</span>
          </div>
        </div>

        <div className="workspace-grid xl:h-[calc(100vh-12rem)]">
          <main className="workspace-sidebar">
            <section className="panel p-5 fade-in">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Capture</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Input sources
                  </h2>
                </div>
                <select
                  value={lang}
                  onChange={(event) =>
                    setLang(event.target.value as "hi-IN" | "en-IN" | "en-US")
                  }
                  className="input-shell min-w-[140px] px-3 py-2 text-sm"
                >
                  <option value="hi-IN">Hinglish</option>
                  <option value="en-IN">English (IN)</option>
                  <option value="en-US">English (US)</option>
                </select>
              </div>

              <div className="mt-4 rounded-3xl bg-white p-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(event) => setConsentAccepted(event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0A66C2]"
                    />
                    <span>I have consent to process this conversation</span>
                  </label>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={handleStartListening}
                    disabled={!isSupported || isListening || isExtracting}
                    className="primary-link"
                  >
                    {isListening ? "Listening..." : "Start"}
                  </button>
                  <button
                    onClick={handleStopListening}
                    disabled={!isListening}
                    className="ghost-link"
                  >
                    Stop
                  </button>
                  <button onClick={handleReset} className="ghost-link">
                    Clear
                  </button>
                </div>

                <div className="mt-4 status-row">
                  <span
                    className={
                      isListening
                        ? "status-dot live"
                        : isExtracting
                          ? "status-dot busy"
                          : "status-dot idle"
                    }
                  />
                  <span>{status}</span>
                </div>
              </div>

              {error ? (
                <div className="error-card mt-4">
                  <strong>Something needs attention.</strong>
                  <p className="mt-1 text-sm">{error}</p>
                </div>
              ) : null}

              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-slate-700">
                    Transcript or notes
                  </label>
                  <span className="text-xs text-muted">{transcript.length} characters</span>
                </div>

                <textarea
                  value={transcript}
                  onChange={(event) => setTranscript(event.target.value)}
                  className="input-shell mt-3 min-h-[220px] w-full resize-none p-4 text-sm"
                  placeholder="Paste a recruiter call, upload a requirement doc, or capture voice input..."
                />

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <label className="ghost-link cursor-pointer">
                    Upload file
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  <button
                    onClick={handleExtract}
                    disabled={isExtracting}
                    className="primary-link"
                  >
                    {isExtracting ? "Extracting..." : "Generate outputs"}
                  </button>
                </div>

                {fileName ? <p className="mt-2 text-xs text-muted">Loaded: {fileName}</p> : null}
                <p className="mt-3 text-xs text-muted">
                  Sensitive identifiers are redacted before AI processing.
                </p>
              </div>
            </section>

            <section className="panel p-5 fade-in">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Capture</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Extraction fields
                  </h2>
                </div>
              </div>

              <p className="text-sm text-muted">
                Keep the field set focused, then add custom attributes only where needed.
              </p>

              <div className="mt-4 space-y-4">
                {Object.entries(groupedFields).map(([category, items]) => (
                  <div key={category}>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      {category}
                    </p>
                    <div className="mt-2 grid gap-2">
                      {items.map((field) => (
                        <label key={field.key} className="field-toggle">
                          <input
                            type="checkbox"
                            checked={field.enabled}
                            onChange={() => handleFieldToggle(field.key)}
                          />
                          <span>
                            <strong>{field.label}</strong>
                            <small>{field.description}</small>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <label className="text-sm font-medium text-slate-700">
                  Add custom field
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    value={customFieldName}
                    onChange={(event) => setCustomFieldName(event.target.value)}
                    placeholder="Visa Sponsorship"
                    className="input-shell w-full px-3 py-2 text-sm"
                  />
                  <button onClick={handleAddCustomField} className="ghost-link">
                    Add
                  </button>
                </div>
              </div>
            </section>

            <section className="panel p-5 fade-in">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Sessions</p>
                  <h2 className="mt-2 text-xl font-semibold text-slate-900">
                    Recent work
                  </h2>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {recentSessions.length ? (
                  recentSessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => handleRestoreSession(session)}
                      className="session-card"
                    >
                      <span className="session-title">{session.title}</span>
                      <span className="session-meta">
                        {session.rows.length} fields · {formatDate(session.updatedAt)}
                      </span>
                    </button>
                  ))
                ) : (
                  <EmptyState
                    title="No recent sessions yet"
                    description="Your previous extractions will appear here for quick resume."
                  />
                )}
              </div>
            </section>
          </main>

          <aside className="workspace-content panel p-5 fade-in">
            <div className="section-header">
              <div>
                <p className="eyebrow">Generated outputs</p>
                <h2 className="mt-2 text-xl font-semibold text-slate-900">
                  Extracted Fields
                </h2>
              </div>

              <div className="flex flex-wrap gap-2">
                {OUTPUT_TABS.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setOutputTab(item.id)}
                    className={outputTab === item.id ? "tab-active" : "tab-idle"}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-[#F8FAFB] p-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">Review status</p>
                <p className="mt-1 text-xs text-muted">
                  {completeness.present}/{completeness.total} core fields are filled.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setTab("capture")} className={tab === "capture" ? "tab-active" : "tab-idle"}>
                  Capture
                </button>
                <button onClick={() => setTab("review")} className={tab === "review" ? "tab-active" : "tab-idle"}>
                  Review
                </button>
                <button onClick={handleTransliterate} className="ghost-link" disabled={!rows.length}>
                  Convert to English
                </button>
                <button onClick={handleShare} className="primary-link" disabled={isSharing || !rows.length}>
                  {isSharing ? "Sharing..." : "Create share link"}
                </button>
              </div>
            </div>

            <div className="mt-4 progress-track">
              <div className="progress-bar" style={{ width: `${completeness.percent}%` }} />
            </div>

            {completeness.missing.length ? (
              <p className="mt-2 text-xs text-[#9A6700]">
                Missing: {completeness.missing.join(", ")}
              </p>
            ) : null}

            {shareUrl ? (
              <div className="notice-card mt-4">
                <p className="text-sm font-medium text-slate-900">Read-only share link</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input readOnly value={shareUrl} className="input-shell w-full px-3 py-2 text-sm" />
                  <button onClick={() => copyText(shareUrl, "Share link")} className="ghost-link">
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            {warnings.length ? (
              <div className="warning-stack mt-4">
                {warnings.map((warning, index) => (
                  <div key={`${warning.type}-${index}`} className="warning-card">
                    <strong>{warning.label}</strong>
                    <p>{warning.message}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {suggestedFields.length ? (
              <div className="soft-panel mt-4 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Suggested fields</p>
                  <p className="mt-1 text-xs text-muted">
                    The AI found extra attributes you may want to track next time.
                  </p>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestedFields.map((field) => (
                    <button
                      key={field.key}
                      onClick={() => handleAcceptSuggestedField(field)}
                      className="pill-action"
                    >
                      + {field.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-5 flex-1 overflow-hidden">
              {isExtracting ? (
                <LoadingState />
              ) : outputTab === "fields" ? (
                rows.length ? (
                  <div className="table-shell fade-in h-full overflow-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="px-4 py-3">Field</th>
                          <th className="px-4 py-3">Value</th>
                          <th className="px-4 py-3">Category</th>
                          <th className="px-4 py-3">Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={row.id || row.field} className="border-t border-slate-200">
                            <td className="px-4 py-3 align-top text-slate-800">
                              <div className="font-medium">{row.field}</div>
                              {row.snippet ? (
                                <p className="mt-1 text-xs text-muted">{row.snippet}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                value={row.value}
                                onChange={(event) =>
                                  handleRowValueChange(row.id, event.target.value)
                                }
                                className="input-shell w-full px-3 py-2 text-sm"
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="pill">{row.category}</span>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-500">
                              {row.confidence.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Start recording to see extracted data"
                    description="Fields will appear here after you capture or paste a hiring conversation and run extraction."
                  />
                )
              ) : (
                <div className="fade-in">
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button onClick={copyMarkdownTable} className="ghost-link" disabled={!rows.length}>
                      Copy MD
                    </button>
                    <button onClick={exportCsv} className="ghost-link" disabled={!rows.length}>
                      Export CSV
                    </button>
                    <button
                      onClick={() => copyText(getOutputByTab(outputTab, outputs), getOutputLabel(outputTab))}
                      className="primary-link"
                      disabled={!getOutputByTab(outputTab, outputs)}
                    >
                      Copy {getOutputLabel(outputTab)}
                    </button>
                  </div>

                  <OutputPanel
                    title={getOutputTitle(outputTab)}
                    value={getOutputByTab(outputTab, outputs)}
                    emptyMessage="Generate outputs to review recruiter-ready content."
                  />
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {toast ? (
        <div className={`toast ${toast.tone}`}>{toast.message}</div>
      ) : null}
    </div>
  );
}

function OutputPanel({
  title,
  value,
  emptyMessage,
}: {
  title: string;
  value: string;
  emptyMessage: string;
}) {
  return (
    <div className="soft-panel min-h-[420px] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <span className="pill">Generated output</span>
      </div>
      {value ? (
        <textarea
          readOnly
          value={value}
          className="input-shell mt-4 min-h-[340px] w-full resize-none p-4 text-sm"
        />
      ) : (
        <EmptyState title="Nothing generated yet" description={emptyMessage} />
      )}
    </div>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" />
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted">{description}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-shell">
      <div className="skeleton h-10 w-40" />
      <div className="skeleton h-20 w-full" />
      <div className="skeleton h-20 w-full" />
      <div className="skeleton h-20 w-4/5" />
    </div>
  );
}

function buildSnapshot({
  sessionId,
  transcript,
  rows,
  selectedFields,
  suggestedFields,
  outputs,
  warnings,
  consentAccepted,
  shareUrl,
}: {
  sessionId: string;
  transcript: string;
  rows: ExtractedFieldRow[];
  selectedFields: ExtractionFieldConfig[];
  suggestedFields: ExtractionFieldConfig[];
  outputs: GeneratedOutputs;
  warnings: ExtractResponse["warnings"];
  consentAccepted: boolean;
  shareUrl: string;
}): SessionSnapshot {
  const now = new Date().toISOString();

  return {
    id: sessionId || createSessionId(),
    title:
      buildSessionTitle(rows) ||
      transcript.slice(0, 48) ||
      "Untitled session",
    transcript,
    rows,
    selectedFields,
    suggestedFields,
    outputs,
    warnings,
    createdAt: now,
    updatedAt: now,
    consentAccepted,
    shareUrl,
    shareId: shareUrl ? shareUrl.split("/").pop() : undefined,
  };
}

function groupFields(fields: ExtractionFieldConfig[]) {
  return fields.reduce<Record<string, ExtractionFieldConfig[]>>((groups, field) => {
    const key = field.kind === "custom" ? "Custom" : field.kind === "suggested" ? "Suggested" : "Core";
    groups[key] = groups[key] || [];
    groups[key].push(field);
    return groups;
  }, {});
}

function getOutputByTab(tab: OutputTabId, outputs: GeneratedOutputs) {
  switch (tab) {
    case "brief":
      return outputs.brief;
    case "email":
      return outputs.email;
    case "jd":
      return outputs.jd;
    case "whatsapp":
      return outputs.whatsapp;
    default:
      return "";
  }
}

function getOutputTitle(tab: OutputTabId) {
  switch (tab) {
    case "brief":
      return "HR Brief";
    case "email":
      return "Email";
    case "jd":
      return "JD";
    case "whatsapp":
      return "WhatsApp";
    default:
      return "Fields";
  }
}

function getOutputLabel(tab: OutputTabId) {
  switch (tab) {
    case "brief":
      return "HR brief";
    case "email":
      return "Email";
    case "jd":
      return "JD";
    case "whatsapp":
      return "WhatsApp";
    default:
      return "Output";
  }
}

const OUTPUT_TABS: Array<{ id: OutputTabId; label: string }> = [
  { id: "fields", label: "Fields" },
  { id: "brief", label: "HR Brief" },
  { id: "email", label: "Email" },
  { id: "jd", label: "JD" },
  { id: "whatsapp", label: "WhatsApp" },
];

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
