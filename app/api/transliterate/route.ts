import { NextResponse } from "next/server";

import { log } from "@/lib/server/logger";
import { assertRateLimit } from "@/lib/server/rate-limit";
import { transliterateValues } from "@/lib/server/transliterate";

type TransliterateBody = {
  values?: string[];
};

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "local";

    assertRateLimit(`transliterate:${ip}`, 40);

    const body = (await request.json()) as TransliterateBody;
    const values = Array.isArray(body.values)
      ? body.values.map((value) => value.trim()).filter(Boolean)
      : [];

    if (!values.length) {
      return NextResponse.json(
        { ok: false, error: "No values provided for transliteration." },
        { status: 400 }
      );
    }

    const result = await transliterateValues(
      values,
      request.headers.get("origin") || undefined
    );

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    log("error", "Transliteration failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    const message =
      error instanceof Error ? error.message : "Failed to transliterate values.";
    const status = message.toLowerCase().includes("rate limit") ? 429 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
