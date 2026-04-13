import { NextResponse } from "next/server";

import { log } from "@/lib/server/logger";
import { requestOpenRouter } from "@/lib/server/openrouter";
import { assertRateLimit } from "@/lib/server/rate-limit";

type RewriteBody = {
  content?: string;
  section?: string;
};

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "local";

    assertRateLimit(`rewrite-output:${ip}`, 30);

    const body = (await request.json()) as RewriteBody;
    const content = body.content?.trim() || "";
    const section = body.section?.trim() || "HR communication";

    if (!content) {
      return NextResponse.json(
        { ok: false, error: "No content provided for rewriting." },
        { status: 400 }
      );
    }

    const result = await requestOpenRouter(
      [
        {
          role: "system",
          content:
            "Rewrite the user's HR communication in a more professional, clear, and polished way. Keep the meaning the same. Return only the rewritten text with no commentary.",
        },
        {
          role: "user",
          content: `Section: ${section}\n\nRewrite this HR communication in a more professional, clear, and polished way. Keep the meaning same but improve tone, clarity, and structure.\n\n${content}`,
        },
      ],
      {
        origin: request.headers.get("origin") || undefined,
        maxTokens: 1400,
        temperature: 0.3,
      }
    );

    return NextResponse.json({ ok: true, result: result.trim() || content });
  } catch (error) {
    log("error", "Rewrite output failed", {
      error: error instanceof Error ? error.message : String(error),
    });

    const message =
      error instanceof Error ? error.message : "Failed to rewrite output.";
    const status = message.toLowerCase().includes("rate limit") ? 429 : 500;

    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
