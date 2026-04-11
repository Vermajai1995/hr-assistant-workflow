import { NextRequest, NextResponse } from "next/server";

import { mergeFieldConfigs, PREDEFINED_FIELDS, sortRows } from "@/lib/hireflow/fields";
import { redactSensitiveContent, scanSensitiveContent } from "@/lib/hireflow/privacy";
import { extractHrFields } from "@/lib/server/extract";
import { log } from "@/lib/server/logger";
import { assertRateLimit } from "@/lib/server/rate-limit";
import type { ExtractionFieldConfig } from "@/types/hireflow";

type ExtractRequestBody = {
  text?: string;
  selectedFields?: ExtractionFieldConfig[];
  consentAccepted?: boolean;
};

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "local";
    assertRateLimit(`extract:${ip}`, 25);

    const body = (await request.json()) as ExtractRequestBody;
    const text = body.text?.trim() || "";

    if (!body.consentAccepted) {
      return NextResponse.json(
        { error: "Consent is required before processing hiring data." },
        { status: 400 }
      );
    }

    if (text.length < 10) {
      return NextResponse.json(
        { error: "Please provide a longer transcript or requirement note." },
        { status: 400 }
      );
    }

    const selectedFields = mergeFieldConfigs(
      PREDEFINED_FIELDS,
      Array.isArray(body.selectedFields) ? body.selectedFields : PREDEFINED_FIELDS
    ).filter((field) => field.enabled);

    const warnings = scanSensitiveContent(text);
    const sanitizedText = redactSensitiveContent(text);

    const result = await extractHrFields({
      text,
      enabledFields: selectedFields,
      sanitizedText,
      warnings,
      origin: request.headers.get("origin") || undefined,
    });

    return NextResponse.json({
      ...result,
      rows: sortRows(result.rows),
    });
  } catch (error) {
    log("error", "Failed to extract HR fields", {
      error: error instanceof Error ? error.message : String(error),
    });

    const message =
      error instanceof Error ? error.message : "Unexpected extraction failure.";
    const status = message.toLowerCase().includes("rate limit") ? 429 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
