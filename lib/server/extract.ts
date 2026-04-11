import { AUTO_SUGGESTABLE_FIELDS } from "@/lib/hireflow/fields";
import { generateOutputs } from "@/lib/hireflow/output";
import type {
  ExtractResponse,
  ExtractedFieldRow,
  ExtractionFieldConfig,
} from "@/types/hireflow";
import { parseJsonResponse, requestOpenRouter } from "@/lib/server/openrouter";

type ModelResponse = {
  rows?: ExtractedFieldRow[];
  suggestedFields?: Array<{
    label: string;
    category?: string;
    reason?: string;
  }>;
  extractionSummary?: string;
};

export async function extractHrFields(input: {
  text: string;
  enabledFields: ExtractionFieldConfig[];
  sanitizedText: string;
  origin?: string;
  warnings: ExtractResponse["warnings"];
}) {
  const prompt = buildExtractionPrompt(input.enabledFields);

  const raw = await requestOpenRouter(
    [
      { role: "system", content: prompt },
      { role: "user", content: input.sanitizedText },
    ],
    {
      origin: input.origin,
      maxTokens: 1600,
      temperature: 0.1,
    }
  );

  const parsed = parseJsonResponse<ModelResponse>(raw);
  const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
  const suggestedFields = Array.isArray(parsed.suggestedFields)
    ? parsed.suggestedFields.map((field): ExtractionFieldConfig => ({
        key: `suggested-${field.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        label: field.label.trim(),
        category: normalizeCategory(field.category),
        description: field.reason?.trim() || "AI-suggested field",
        kind: "suggested" as const,
        enabled: false,
      }))
    : [];

  const summary =
    parsed.extractionSummary?.trim() ||
    (rows.length
      ? `Detected ${rows.length} structured fields from the requirement.`
      : "No structured fields were confidently detected.");

  return {
    rows,
    suggestedFields,
    warnings: input.warnings,
    outputs: generateOutputs(rows),
    sanitizedText: input.sanitizedText,
    extractionSummary: summary,
  } satisfies ExtractResponse;
}

function buildExtractionPrompt(enabledFields: ExtractionFieldConfig[]) {
  const fieldInstructions = enabledFields
    .map(
      (field) =>
        `- "${field.label}" (${field.category}): ${field.description}`
    )
    .join("\n");

  return `
You are HireFlow, an expert recruiter assistant that converts hiring conversations into structured HR requirement data.

The transcript may be in Hindi, English, or Hinglish.
Return valid JSON only.

Extract ONLY these enabled fields when present:
${fieldInstructions}

Also auto-detect additional useful fields, but do not add them to rows unless they were explicitly enabled.
Instead, return those under "suggestedFields" when clearly supported by the text.
Suggested fields can include examples such as: ${AUTO_SUGGESTABLE_FIELDS.join(", ")}.

Rules:
- Normalize salary and budget into clean monthly format, for example "7k-15k" becomes "7000-15000".
- Keep field labels exactly as provided for enabled fields.
- Use confidence from 0 to 1.
- Use short supporting snippets from the transcript.
- Merge duplicates into one clean row.
- Do not invent data.

Return this shape:
{
  "rows": [
    {
      "field": "Client Name",
      "value": "Bhole Ram",
      "category": "client",
      "confidence": 0.92,
      "snippet": "mera naam bhole ram hai"
    }
  ],
  "suggestedFields": [
    {
      "label": "Company Type",
      "category": "client",
      "reason": "The transcript mentions a startup client."
    }
  ],
  "extractionSummary": "One short sentence"
}
`;
}

function normalizeCategory(category?: string) {
  switch ((category || "").toLowerCase()) {
    case "client":
    case "role":
    case "openings":
    case "budget":
    case "location":
      return category as "client" | "role" | "openings" | "budget" | "location";
    default:
      return "meta";
  }
}
