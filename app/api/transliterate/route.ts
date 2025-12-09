import { NextResponse } from "next/server";

type TransliterateBody = {
  values: string[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TransliterateBody;
    const values = Array.isArray(body.values) ? body.values : [];

    if (!values.length) {
      return NextResponse.json(
        { ok: false, error: "No values provided for transliteration." },
        { status: 400 }
      );
    }

    const prompt = `
Transliterate the following Hindi / Hinglish words into clean English Latin letters.
DO NOT translate meaning, ONLY transliterate sounds.

Input:
${values.map((v: string, i: number) => `${i + 1}. ${v}`).join("\n")}

Return JSON array, same order, only transliterated values.
Example output: ["Bhole Ram", "Lucknow"]
`;

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        {
          ok: false,
          error:
            `OpenRouter error: ${res.status} ${res.statusText}` +
            (text ? ` - ${text}` : ""),
        },
        { status: 500 }
      );
    }

    const data = await res.json();

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "No content returned from model." },
        { status: 500 }
      );
    }

    let output: string[];
    try {
      output = JSON.parse(content);
    } catch {
      // In case model replies with ```json ... ```
      const cleaned = content.replace(/```json|```/g, "").trim();
      output = JSON.parse(cleaned);
    }

    return NextResponse.json({ ok: true, result: output });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Failed to transliterate" },
      { status: 500 }
    );
  }
}
