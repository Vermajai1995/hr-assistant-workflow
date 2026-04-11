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
import { getPrivacyDisclaimer } from "@/lib/hireflow/privacy";
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <section className="hero-panel">
        <div className="max-w-3xl">
          <p className="eyebrow">Production-ready hiring intake</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance">
            Capture voice, documents, and transcripts into a clean HR-ready workspace.
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted">
            HireFlow turns unstructured hiring conversations into reusable recruiter outputs, with consent, privacy checks, recent sessions, and read-only sharing built in.
          </p>
        </div>

        <div className="hero-actions">
          <button
            onClick={handleStartListening}
            disabled={!isSupported || isListening || isExtracting}
            className="primary-link"
          >
            {isListening ? "Listening..." : "Start voice capture"}
          </button>
          <button
            onClick={handleExtract}
            disabled={isExtracting}
            className="ghost-link"
          >
            {isExtracting ? "Extracting..." : "Run extraction"}
          </button>
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <main className="space-y-6">
          <section className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="eyebrow">Session controls</p>
                <h2 className="mt-2 text-2xl font-semibold">Capture requirement</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <select
                  value={lang}
                  onChange={(event) =>
                    setLang(event.target.value as "hi-IN" | "en-IN" | "en-US")
                  }
                  className="input-shell min-w-[140px]"
                >
                  <option value="hi-IN">Hinglish</option>
                  <option value="en-IN">English (IN)</option>
                  <option value="en-US">English (US)</option>
                </select>
                <button
                  onClick={handleStopListening}
                  disabled={!isListening}
                  className="ghost-link"
                >
                  Stop
                </button>
                <button onClick={handleReset} className="ghost-link">
                  New session
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
              <div className="space-y-4">
                <div className="notice-card">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={consentAccepted}
                      onChange={(event) => setConsentAccepted(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent"
                    />
                    <span>
                      <strong className="text-slate-100">
                        Consent required before recording or processing.
                      </strong>
                      <span className="mt-1 block text-sm text-muted">
                        Confirm that the speaker knows this conversation is being processed for hiring operations.
                      </span>
                    </span>
                  </label>
                </div>

                <div className="privacy-card">
                  <p className="text-sm font-medium text-slate-100">Privacy guardrail</p>
                  <p className="mt-2 text-sm text-muted">{getPrivacyDisclaimer()}</p>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="text-sm font-medium text-slate-200">
                      Transcript or notes
                    </label>
                    <span className="text-xs text-muted">
                      {transcript.length} characters
                    </span>
                  </div>

                  <textarea
                    value={transcript}
                    onChange={(event) => setTranscript(event.target.value)}
                    className="input-shell mt-3 min-h-[240px] w-full resize-y p-4 text-sm"
                    placeholder="Paste a recruiter call, upload a requirement doc, or capture voice input..."
                  />

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="ghost-link cursor-pointer">
                      Upload PDF / DOCX / TXT
                      <input
                        type="file"
                        accept=".pdf,.docx,.txt"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                    {fileName ? <span className="pill">{fileName}</span> : null}
                    <button
                      onClick={handleExtract}
                      disabled={isExtracting}
                      className="primary-link"
                    >
                      {isExtracting ? "Extracting..." : "Sync & extract fields"}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="soft-panel p-4">
                  <p className="text-sm font-semibold text-slate-100">Enabled extraction fields</p>
                  <p className="mt-1 text-xs text-muted">
                    Keep the default set lean, then add only the fields you want extracted and included in outputs.
                  </p>

                  <div className="mt-4 space-y-4">
                    {Object.entries(groupedFields).map(([category, items]) => (
                      <div key={category}>
                        <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
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

                  <div className="mt-5 border-t border-white/10 pt-4">
                    <label className="text-sm font-medium text-slate-200">
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
                </div>
              </div>
            </div>
          </section>

          <section className="panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Review workspace</p>
                <h2 className="mt-2 text-2xl font-semibold">Extraction review</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setTab("capture")}
                  className={tab === "capture" ? "tab-active" : "tab-idle"}
                >
                  Capture
                </button>
                <button
                  onClick={() => setTab("review")}
                  className={tab === "review" ? "tab-active" : "tab-idle"}
                >
                  Review
                </button>
              </div>
            </div>

            {error ? (
              <div className="error-card mt-5">
                <strong>Something needs attention.</strong>
                <p className="mt-1 text-sm">{error}</p>
              </div>
            ) : null}

            <div className="mt-5 status-row">
              <span className={isListening ? "status-dot live" : isExtracting ? "status-dot busy" : "status-dot idle"} />
              <span>{status}</span>
            </div>

            {tab === "review" ? (
              <div className="mt-6 space-y-5">
                <div className="soft-panel p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        Completeness
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {completeness.present}/{completeness.total} core fields are filled.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={handleTransliterate} className="ghost-link">
                        Convert to English
                      </button>
                      <button onClick={copyMarkdownTable} className="ghost-link">
                        Copy MD
                      </button>
                      <button onClick={exportCsv} className="ghost-link">
                        Export CSV
                      </button>
                      <button onClick={handleShare} className="primary-link" disabled={isSharing}>
                        {isSharing ? "Sharing..." : "Create share link"}
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 progress-track">
                    <div
                      className="progress-bar"
                      style={{ width: `${completeness.percent}%` }}
                    />
                  </div>

                  {completeness.missing.length ? (
                    <p className="mt-2 text-xs text-amber-200">
                      Missing: {completeness.missing.join(", ")}
                    </p>
                  ) : null}

                  {shareUrl ? (
                    <div className="notice-card mt-4">
                      <p className="text-sm font-medium text-slate-100">
                        Read-only share link
                      </p>
                      <div className="mt-2 flex flex-col gap-2 md:flex-row">
                        <input
                          readOnly
                          value={shareUrl}
                          className="input-shell w-full px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => copyText(shareUrl, "Share link")}
                          className="ghost-link"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                {warnings.length ? (
                  <div className="warning-stack">
                    {warnings.map((warning, index) => (
                      <div key={`${warning.type}-${index}`} className="warning-card">
                        <strong>{warning.label}</strong>
                        <p>{warning.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {suggestedFields.length ? (
                  <div className="soft-panel p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-100">
                          Suggested fields
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          The AI found extra attributes you may want to track on the next run.
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
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

                <div className="table-shell overflow-hidden">
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
                      {rows.length ? (
                        rows.map((row) => (
                          <tr key={row.id || row.field} className="border-t border-white/10">
                            <td className="px-4 py-3 align-top text-slate-200">
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
                            <td className="px-4 py-3 align-top text-slate-400">
                              {row.confidence.toFixed(2)}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="px-4 py-10 text-center text-muted">
                            Extract a transcript to populate the structured table.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <OutputCard
                    title="HR brief"
                    value={outputs.brief}
                    onCopy={() => copyText(outputs.brief, "HR brief")}
                  />
                  <OutputCard
                    title="Email draft"
                    value={outputs.email}
                    onCopy={() => copyText(outputs.email, "Email draft")}
                  />
                  <OutputCard
                    title="Short JD"
                    value={outputs.jd}
                    onCopy={() => copyText(outputs.jd, "Short JD")}
                  />
                  <OutputCard
                    title="WhatsApp summary"
                    value={outputs.whatsapp}
                    onCopy={() => copyText(outputs.whatsapp, "WhatsApp summary")}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-6 soft-panel p-6 text-sm text-muted">
                Use the capture tab to bring in voice, text, or file inputs. Once extraction runs, this review space will show the structured table, warnings, suggested fields, and generated outputs.
              </div>
            )}
          </section>
        </main>

        <aside className="space-y-6">
          <section className="panel p-5">
            <p className="eyebrow">Recent sessions</p>
            <h2 className="mt-2 text-xl font-semibold">Resume previous work</h2>
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
                <p className="text-sm text-muted">
                  Recent sessions will appear here after your first extraction.
                </p>
              )}
            </div>
          </section>

          <section className="panel p-5">
            <p className="eyebrow">Lean architecture</p>
            <h2 className="mt-2 text-xl font-semibold">What changed</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted">
              <li>Shared AI, privacy, output, and rate-limit logic moved into reusable `lib/` modules.</li>
              <li>Consent, privacy redaction, recent sessions, and share links are part of the default workflow.</li>
              <li>Dynamic field selection keeps extraction flexible without overwhelming the user.</li>
            </ul>
          </section>
        </aside>
      </div>

      {toast ? (
        <div className={`toast ${toast.tone}`}>{toast.message}</div>
      ) : null}
    </div>
  );
}

function OutputCard({
  title,
  value,
  onCopy,
}: {
  title: string;
  value: string;
  onCopy: () => void;
}) {
  return (
    <div className="soft-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
        <button onClick={onCopy} className="ghost-link">
          Copy
        </button>
      </div>
      <textarea
        readOnly
        value={value}
        className="input-shell mt-4 min-h-[180px] w-full resize-y p-4 text-sm"
      />
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
