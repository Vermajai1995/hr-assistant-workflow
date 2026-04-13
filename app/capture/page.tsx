"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { useGlobalLoader } from "@/components/global-loader";
import {
  buildSessionTitle,
  CORE_FIELD_LABELS,
  createCustomField,
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

type StepId = "capture" | "review" | "output";
type OutputTabId = "fields" | "brief" | "email" | "jd" | "whatsapp";
type EditableOutputTabId = Exclude<OutputTabId, "fields">;
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

const SAMPLE_TRANSCRIPT = `Recruiter: Hello sir, mai Riya bol rahi hu ABC Consulting se, hum companies ke liye hiring support karte hain. Kya aapke yahan abhi koi openings ya requirements hai?
Client: Haan ji, mai Gautam bol raha hu XYZ Company se. Abhi hume kuch hiring karni hai.
Recruiter: Ji sir, kis type ke profiles chahiye aapko?
Client: Hume 5 junior developers chahiye, fresher bhi chalega.
Recruiter: Okay sir, location kya rahegi aur work mode kaisa hoga? Remote, hybrid ya work from office?
Client: Location Pune rahegi aur work from office hi hai, hybrid option abhi nahi hai.
Recruiter: Samajh gaya sir. Experience range kya consider karna hai?
Client: Freshers preferred hai, lekin 0-1 year tak ka experience bhi chalega.
Recruiter: Budget kya rahega in roles ke liye?
Client: Freshers ke liye max 25-30k per month tak ka budget hai.
Recruiter: Notice period ya joining timeline kya rahegi?
Client: Immediate joiners preferred hai ya max 15 days notice wale.
Recruiter: Skills me kya mandatory chahiye?
Client: Developers ke liye .NET, SQL aur basic API knowledge. QA ke liye manual testing aur thoda automation ka idea hona chahiye.
Recruiter: Working days aur timings kya rahenge?
Client: 6 working days rahenge aur timing approx 10 se 6 PM.
Recruiter: Hiring urgency kitni hai sir?
Client: Thoda urgent hai, next 2-3 weeks me positions close karni hai.
Recruiter: Perfect sir, main aapke liye relevant profiles share karti hu shortly.`;

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
  const [currentStep, setCurrentStep] = useState<StepId>("capture");
  const [transcript, setTranscript] = useState(SAMPLE_TRANSCRIPT);
  const [rows, setRows] = useState<ExtractedFieldRow[]>([]);
  const [selectedFields, setSelectedFields] = useState<ExtractionFieldConfig[]>(
    PREDEFINED_FIELDS
  );
  const [suggestedFields, setSuggestedFields] = useState<ExtractionFieldConfig[]>([]);
  const [reviewSelection, setReviewSelection] = useState<Record<string, boolean>>({});
  const [outputs, setOutputs] = useState<GeneratedOutputs>(EMPTY_OUTPUTS);
  const [warnings, setWarnings] = useState<ExtractResponse["warnings"]>([]);
  const [status, setStatus] = useState("Ready to capture a hiring requirement.");
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(true);
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
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [lastExtractionSignature, setLastExtractionSignature] = useState("");
  const [rewritingTab, setRewritingTab] = useState<EditableOutputTabId | null>(null);
  const [highlightedOutputTab, setHighlightedOutputTab] =
    useState<EditableOutputTabId | null>(null);

  const recognitionRef = useRef<SpeechRecognitionType | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const { showLoader, hideLoader } = useGlobalLoader();

  const completeness = useMemo(
    () => getCompleteness(rows, CORE_FIELD_LABELS),
    [rows]
  );
  const extractionSignature = useMemo(
    () =>
      JSON.stringify({
        transcript: transcript.trim(),
        selectedFields: selectedFields
          .filter((field) => field.enabled)
          .map((field) => field.key)
          .sort(),
      }),
    [selectedFields, transcript]
  );
  const visibleRows = useMemo(
    () => rows.filter((row) => reviewSelection[getRowKey(row)] ?? true),
    [rows, reviewSelection]
  );
  const customFields = useMemo(
    () => selectedFields.filter((field) => field.kind === "custom"),
    [selectedFields]
  );
  const allRowsSelected =
    rows.length > 0 &&
    rows.every((row) => reviewSelection[getRowKey(row)] ?? true);

  useEffect(() => {
    setMounted(true);
    setSessionId(createSessionId());
  }, []);

  useEffect(() => {
    if (!mounted) {
      return;
    }
    showToast("By using this tool, you consent to processing your input.", "info");
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
    if (!rows.length) {
      setReviewSelection({});
      return;
    }

    setReviewSelection((current) => {
      const next: Record<string, boolean> = {};
      for (const row of rows) {
        const key = getRowKey(row);
        next[key] =
          current[key] ?? (row.kind === "custom" || DEFAULT_REVIEW_FIELDS.has(row.field));
      }
      return next;
    });
  }, [rows]);

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
      setTranscript(formatConversationTranscript(value.trim()));
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
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
    };
  }, []);

  function showToast(message: string, tone: ToastTone = "success") {
    setToast({ message, tone });
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2000);
  }

  function triggerOutputHighlight(tab: EditableOutputTabId) {
    setHighlightedOutputTab(tab);
    if (highlightTimerRef.current) {
      window.clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = window.setTimeout(() => {
      setHighlightedOutputTab((current) => (current === tab ? null : current));
    }, 1500);
  }

  async function autoCopyHrBrief(brief: string) {
    if (!brief.trim()) {
      return;
    }

    try {
      await navigator.clipboard.writeText(brief);
      triggerOutputHighlight("brief");
      showToast("HR Brief copied — ready to paste anywhere 🚀", "success");
    } catch {
      // fail silently by design
    }
  }

  async function runExtraction(nextStep: StepId = "review") {
    if (!consentAccepted) {
      setError("Please confirm consent before processing hiring data.");
      return false;
    }

    if (!transcript.trim()) {
      setError("Add a transcript, file, or live voice capture before extracting.");
      return false;
    }

    setIsExtracting(true);
    setError(null);
    setStatus("Extracting fields, suggested attributes, and polished outputs...");
    const loaderId = showLoader(nextStep === "output" ? "generate" : "review");

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
      setCurrentStep(nextStep);
      setOutputTab(nextStep === "output" ? "brief" : "fields");
      setLastExtractionSignature(extractionSignature);
      if (nextStep === "output") {
        void autoCopyHrBrief(data.outputs.brief);
      }
      showToast(`Extracted ${nextRows.length} fields`, "success");
      return true;
    } catch (extractError) {
      setError(
        extractError instanceof Error
          ? extractError.message
          : "Unexpected extraction failure."
      );
      setStatus("Extraction did not complete.");
      showToast("Extraction failed", "error");
      return false;
    } finally {
      setIsExtracting(false);
      hideLoader(loaderId);
    }
  }

  async function handleExtract() {
    await runExtraction("review");
  }

  async function ensureFreshExtraction(nextStep: StepId) {
    if (nextStep === "capture") {
      setCurrentStep("capture");
      return;
    }

    const needsExtraction = !rows.length || extractionSignature !== lastExtractionSignature;

    if (needsExtraction) {
      await runExtraction(nextStep);
      return;
    }

    setCurrentStep(nextStep);
    setOutputTab("fields");
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
    setCurrentStep("capture");
    setLastExtractionSignature("");

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

  function handleReviewSelectionToggle(row: ExtractedFieldRow) {
    const key = getRowKey(row);
    setReviewSelection((current) => ({
      ...current,
      [key]: !(current[key] ?? true),
    }));
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
    setCurrentStep(snapshot.rows.length ? "review" : "capture");
    setLastExtractionSignature(
      JSON.stringify({
        transcript: snapshot.transcript.trim(),
        selectedFields: snapshot.selectedFields
          .filter((field) => field.enabled)
          .map((field) => field.key)
          .sort(),
      })
    );
    setError(null);
    setSessionsOpen(false);
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

        setTranscript(formatConversationTranscript(parsedText.trim()));
      } else if (
        file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const mammoth = await import("mammoth/mammoth.browser");
        const result = await mammoth.extractRawText({
          arrayBuffer: await file.arrayBuffer(),
        });
        setTranscript(formatConversationTranscript(result.value.trim()));
      } else {
        setTranscript(formatConversationTranscript((await file.text()).trim()));
      }

      setCurrentStep("capture");
      setRows([]);
      setLastExtractionSignature("");
      showToast(`Loaded ${file.name}`, "success");
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
    setConsentAccepted(true);
    setShareUrl("");
    setStatus("Started a fresh session.");
    setError(null);
    setCurrentStep("capture");
    setFileName("");
    setOutputTab("fields");
    setLastExtractionSignature("");
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

  function handleOutputChange(tab: EditableOutputTabId, value: string) {
    setOutputs((current) => ({
      ...current,
      [tab]: value,
    }));
  }

  async function handleRewriteOutput(tab: EditableOutputTabId) {
    const currentValue = outputs[tab];

    if (!currentValue.trim()) {
      return;
    }

    setRewritingTab(tab);
    setError(null);
    const loaderId = showLoader("rewrite");

    try {
      const response = await fetch("/api/rewrite-output", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: currentValue,
          section: getOutputTitle(tab),
        }),
      });

      const data = (await response.json()) as {
        ok?: boolean;
        result?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.result) {
        throw new Error(data.error || "Rewrite failed.");
      }

      setOutputs((current) => ({
        ...current,
        [tab]: data.result || current[tab],
      }));
      showToast(`${getOutputTitle(tab)} updated`, "success");
    } catch (rewriteError) {
      setError(
        rewriteError instanceof Error
          ? rewriteError.message
          : "Unexpected rewrite failure."
      );
      showToast("Rewrite failed", "error");
    } finally {
      setRewritingTab(null);
      hideLoader(loaderId);
    }
  }

  function copyMarkdownTable() {
    const exportRows = visibleRows.length ? visibleRows : rows;
    const header =
      "| # | Field | Value | Category | Confidence | Snippet |\n|---|---|---|---|---|---|\n";
    const body = exportRows
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
    const exportRows = visibleRows.length ? visibleRows : rows;
    const csv =
      "Index,Field,Value,Category,Confidence,Snippet\n" +
      exportRows
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

    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "hireflow-session.csv";
    link.click();
    URL.revokeObjectURL(url);
    showToast("CSV exported", "success");
  }

  const groupedFields = groupFields(selectedFields);
  const reviewReadyCount = visibleRows.length;

  if (!mounted) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-sm text-muted">Loading HireFlow...</div>;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-4">
      <section className="workspace-shell fade-in">
        <div className="workspace-topbar">
          <div>
            <p className="eyebrow">Workspace</p>
            <h1 className="mt-1 text-[1.5rem] font-semibold text-slate-900">
              Hiring workflow
            </h1>
          </div>

          <div className="session-menu">
            <button
              onClick={() => setSessionsOpen((current) => !current)}
              className="ghost-link"
              type="button"
            >
              Sessions
            </button>

            {sessionsOpen ? (
              <div className="session-popover fade-in">
                <div className="session-popover-header">
                  <strong>Recent sessions</strong>
                  <span className="text-xs text-muted">{recentSessions.length} saved</span>
                </div>

                <div className="mt-3 space-y-2">
                  {recentSessions.length ? (
                    recentSessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => handleRestoreSession(session)}
                        className="session-card"
                      >
                        <span className="session-title">{session.title}</span>
                        <span className="session-meta">
                          {formatDate(session.updatedAt)} · {session.rows.length} fields
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="text-sm text-muted">
                      Recent sessions will appear here after your first extraction.
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="step-nav" aria-label="workflow steps">
          {STEPS.map((step, index) => {
            const completed = isStepCompleted(step.id, rows);
            const active = currentStep === step.id;

            return (
              <button
                key={step.id}
                type="button"
                className={`step-link ${active ? "active" : ""} ${completed ? "complete" : ""}`}
                onClick={() => void ensureFreshExtraction(step.id)}
                disabled={isExtracting}
              >
                <span className="step-index">{completed ? "✓" : index + 1}</span>
                <span>{step.label}</span>
              </button>
            );
          })}
        </div>

        {error ? (
          <div className="error-card">
            <strong>Something needs attention.</strong>
            <p className="mt-1 text-sm">{error}</p>
          </div>
        ) : null}

        {currentStep === "capture" ? (
          <section className="panel p-5 fade-in workspace-panel compact-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 className="mt-1 text-[1.1rem] font-semibold text-slate-900">Capture</h2>
              </div>
            </div>

            <div className="capture-toolbar">
              <select
                value={lang}
                onChange={(event) =>
                  setLang(event.target.value as "hi-IN" | "en-IN" | "en-US")
                }
                className="input-shell min-w-[160px] px-3 py-2 text-sm"
              >
                <option value="hi-IN">Hinglish</option>
                <option value="en-IN">English</option>
                <option value="en-US">English (US)</option>
              </select>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={consentAccepted}
                  onChange={(event) => setConsentAccepted(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#0A66C2]"
                />
                <span>I have consent to process this conversation</span>
              </label>

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

              <span className="capture-status-copy">{status}</span>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-medium text-slate-700">Conversation input</label>
                <span className="text-xs text-muted">{transcript.length} characters</span>
              </div>

              <textarea
                value={transcript}
                onChange={(event) => setTranscript(event.target.value)}
                className="input-shell mt-2 min-h-[220px] w-full resize-none p-3 text-[0.88rem] leading-6"
                placeholder="Paste the hiring conversation here..."
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="ghost-link cursor-pointer">
                    Upload file
                    <input
                      type="file"
                      accept=".pdf,.docx,.txt"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                  {fileName ? <span className="pill">{fileName}</span> : null}
                </div>

                <button
                  onClick={handleExtract}
                  disabled={isExtracting}
                  className="primary-link"
                >
                  {isExtracting ? "Processing..." : "Next"}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {currentStep === "review" ? (
          <section className="panel p-5 fade-in workspace-panel compact-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Step 2</p>
                <h2 className="mt-1 text-[1.1rem] font-semibold text-slate-900">Review Fields</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCurrentStep("capture")} className="ghost-link">
                  Back
                </button>
                <button
                  onClick={() => void ensureFreshExtraction("output")}
                  className="primary-link"
                  disabled={isExtracting || !rows.length || reviewReadyCount < 1}
                >
                  Generate Output
                </button>
              </div>
            </div>

            {rows.length ? (
              <>
                <div className="mt-3 review-meta">
                  <div className="review-meta-line">
                    <span className="font-semibold text-slate-900">Review status</span>
                    <span className="text-muted">|</span>
                    <span>{reviewReadyCount} fields selected</span>
                    <span className="text-muted">|</span>
                    <span>
                      {completeness.present}/{completeness.total} core fields filled
                    </span>
                  </div>
                  <div className="progress-track review-progress">
                    <div className="progress-bar" style={{ width: `${completeness.percent}%` }} />
                  </div>
                </div>

                <div className="selection-toolbar mt-3">
                  <button
                    onClick={() =>
                      setReviewSelection(
                        Object.fromEntries(
                          rows.map((row) => [getRowKey(row), !allRowsSelected])
                        )
                      )
                    }
                    className="ghost-link smart-toggle"
                    type="button"
                  >
                    <span>{allRowsSelected ? "☑" : "☐"}</span>
                    <span>{allRowsSelected ? "Deselect All" : "Select All"}</span>
                  </button>
                </div>

                {warnings.length ? (
                  <div className="warning-stack mt-3">
                    {warnings.map((warning, index) => (
                      <div key={`${warning.type}-${index}`} className="warning-card">
                        <strong>{warning.label}</strong>
                        <p>{warning.message}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {suggestedFields.length ? (
                  <div className="soft-panel mt-3 p-3.5">
                    <p className="text-sm font-semibold text-slate-900">Suggested fields</p>
                    <p className="mt-0.5 text-xs text-muted">
                      The AI found extra attributes you may want to track next time.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
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

                <div className="review-grid mt-3">
                  {rows.map((row) => {
                    const checked = reviewSelection[getRowKey(row)] ?? true;

                    return (
                      <label
                        key={getRowKey(row)}
                        className={`field-card ${checked ? "selected" : "muted"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => handleReviewSelectionToggle(row)}
                        />
                        <span className="field-card-label">{row.field}</span>
                      </label>
                    );
                  })}
                </div>

                <div className="review-config-grid mt-3">
                  <div className="soft-panel p-3.5">
                    <p className="text-sm font-semibold text-slate-900">Extraction fields</p>
                    <div className="mt-3 space-y-3">
                      {Object.entries(groupedFields).map(([category, items]) => (
                        <div key={category}>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                            {category}
                          </p>
                          <div className="mt-2 grid gap-2 field-toggle-grid">
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
                  </div>

                  <div className="soft-panel p-3.5">
                    <p className="text-sm font-semibold text-slate-900">Custom field</p>
                    <p className="mt-0.5 text-xs text-muted">
                      Add new extraction labels without changing the underlying workflow.
                    </p>
                    <div className="mt-3 flex gap-2">
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
                    {customFields.length ? (
                      <div className="mt-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Custom Fields
                        </p>
                        <div className="custom-field-list mt-2">
                          {customFields.map((field) => (
                            <span key={field.key} className="custom-field-chip">
                              <span>✔</span>
                              <span>{field.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <EmptyState
                title="Start capturing to proceed"
                description="Run extraction from Step 1 to review your structured fields."
              />
            )}
          </section>
        ) : null}

        {currentStep === "output" ? (
          <section className="panel p-5 fade-in workspace-panel compact-panel">
            <div className="section-header">
              <div>
                <p className="eyebrow">Step 3</p>
                <h2 className="mt-1 text-[1.1rem] font-semibold text-slate-900">Generate Output</h2>
              </div>

              <div className="flex flex-wrap gap-2">
                <button onClick={() => setCurrentStep("review")} className="ghost-link">
                  Back
                </button>
                <button onClick={handleTransliterate} className="ghost-link" disabled={!rows.length}>
                  Convert to English
                </button>
                <button
                  onClick={handleShare}
                  className="primary-link"
                  disabled={isSharing || !rows.length}
                >
                  {isSharing ? "Sharing..." : "Create share link"}
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
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

            {shareUrl ? (
              <div className="notice-card mt-3">
                <p className="text-sm font-medium text-slate-900">Read-only share link</p>
                <div className="mt-2 flex flex-col gap-2 md:flex-row">
                  <input readOnly value={shareUrl} className="input-shell w-full px-3 py-2 text-sm" />
                  <button onClick={() => copyText(shareUrl, "Share link")} className="ghost-link">
                    Copy
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 flex-1 overflow-hidden">
              {outputTab === "fields" ? (
                visibleRows.length ? (
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
                        {visibleRows.map((row) => (
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
                                className={`input-shell w-full px-3 py-2 text-sm ${
                                  row.value === "N/A" ? "text-[#B42318]" : ""
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <span className="pill">{row.category}</span>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <ConfidenceBadge confidence={row.confidence} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Start capturing to proceed"
                    description="Run extraction first, then your structured fields will appear here."
                  />
                )
              ) : (
                <div className="fade-in">
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button onClick={copyMarkdownTable} className="ghost-link" disabled={!rows.length}>
                      Copy MD
                    </button>
                    <button onClick={exportCsv} className="ghost-link" disabled={!rows.length}>
                      Export CSV
                    </button>
                    <button
                      onClick={() =>
                        copyText(getOutputByTab(outputTab, outputs), getOutputLabel(outputTab))
                      }
                      className="primary-link"
                      disabled={!getOutputByTab(outputTab, outputs)}
                    >
                      Copy {getOutputLabel(outputTab)}
                    </button>
                  </div>

                  <OutputPanel
                    title={getOutputTitle(outputTab)}
                    value={getOutputByTab(outputTab, outputs)}
                    onChange={(value) =>
                      handleOutputChange(outputTab as EditableOutputTabId, value)
                    }
                    onRewrite={() =>
                      void handleRewriteOutput(outputTab as EditableOutputTabId)
                    }
                    isRewriting={rewritingTab === outputTab}
                    isHighlighted={highlightedOutputTab === outputTab}
                    emptyMessage="Generate outputs to review recruiter-ready content."
                  />
                </div>
              )}
            </div>
          </section>
        ) : null}
      </section>

      {toast ? <div className={`toast ${toast.tone}`}>{toast.message}</div> : null}
    </div>
  );
}

function OutputPanel({
  title,
  value,
  onChange,
  onRewrite,
  isRewriting,
  isHighlighted,
  emptyMessage,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  onRewrite: () => void;
  isRewriting: boolean;
  isHighlighted: boolean;
  emptyMessage: string;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    if (!value.trim()) {
      return;
    }

    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => {
        // fail silently by design
      });
  }

  return (
    <div
      className={`soft-panel min-h-[360px] p-3.5 transition-all duration-300 ${
        isHighlighted ? "output-panel-highlight" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill">Generated output</span>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value.trim()}
            className="ghost-link"
            title={copied ? "Copied!" : "Copy"}
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            type="button"
            onClick={onRewrite}
            disabled={isRewriting || !value.trim()}
            className="ghost-link"
          >
            {isRewriting ? "Rewriting..." : "🤖 Rewrite with AI"}
          </button>
        </div>
      </div>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={emptyMessage}
        className={`input-shell mt-3 min-h-[290px] w-full resize-none p-3 text-sm leading-6 ${
          /\bN\/A\b/.test(value) ? "text-[#B42318]" : ""
        }`}
      />
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

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level =
    confidence >= 0.85 ? "high" : confidence >= 0.65 ? "medium" : "low";
  const label = level === "high" ? "High" : level === "medium" ? "Medium" : "Low";

  return (
    <span className={`confidence-badge ${level}`}>
      <span className="confidence-dot" />
      {label}
    </span>
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
    title: buildSessionTitle(rows) || transcript.slice(0, 48) || "Untitled session",
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
    const key =
      field.kind === "custom" ? "Custom" : field.kind === "suggested" ? "Suggested" : "Core";
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

function getRowKey(row: ExtractedFieldRow) {
  return row.id || `${row.field}-${row.category}`;
}

function formatConversationTranscript(value: string) {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return value;
  }

  const hasExplicitSpeakers = lines.some((line) => /^[A-Za-z ]+:/u.test(line));
  if (hasExplicitSpeakers) {
    return lines.join("\n");
  }

  return lines
    .map((line, index) => `User ${index % 2 === 0 ? 1 : 2}: ${line}`)
    .join("\n");
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

function isStepCompleted(step: StepId, rows: ExtractedFieldRow[]) {
  if (step === "capture") {
    return rows.length > 0;
  }
  if (step === "review") {
    return rows.length > 0;
  }
  return false;
}

const OUTPUT_TABS: Array<{ id: OutputTabId; label: string }> = [
  { id: "fields", label: "Fields" },
  { id: "brief", label: "HR Brief" },
  { id: "email", label: "Email" },
  { id: "jd", label: "JD" },
  { id: "whatsapp", label: "WhatsApp" },
];

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: "capture", label: "Capture" },
  { id: "review", label: "Review Fields" },
  { id: "output", label: "Generate Output" },
];

const DEFAULT_REVIEW_FIELDS = new Set([
  "Position Title",
  "Total Openings",
  "Budget Range (INR/month)",
  "Client Location / City",
]);
