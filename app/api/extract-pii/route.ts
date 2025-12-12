// app/api/extract-pii/route.ts
import { NextRequest, NextResponse } from "next/server";

type PiiRow = {
  field: string;
  value: string;
  category: string;
  confidence: number;
  snippet?: string;
};

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL =
  process.env.OPENROUTER_MODEL || "openai/gpt-4.1-mini";
const OPENROUTER_BASE_URL =
  process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1";

export async function POST(req: NextRequest) {
  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "Missing OPENROUTER_API_KEY" },
      { status: 500 }
    );
  }

  const { text } = await req.json();

  if (!text || typeof text !== "string" || text.trim().length < 10) {
    return NextResponse.json(
      { error: "Transcript too short or missing" },
      { status: 400 }
    );
  }

  const prompt = `
You are an HR hiring requirement extractor.

The input is a free-form conversation transcript between:
- An HR person and
- A client / agency / vendor

They talk in Hindi, English or mix (Hinglish). Your job is to understand the conversation and extract all **structured hiring requirement details**.

IMPORTANT:
Focus on these fields whenever present (even indirectly):

Client / contact details:
- "Client Name"                 // person speaking (e.g. "Bhola Ram")
- "Client Company / Agency"     // company/agency name
- "Client Location / City"      // e.g. "Lucknow"

Requirement details:
- "Position Title"              // e.g. "Software Engineer", "Sales Executive"
- "Total Openings"              // how many people needed, as a number
- "Experience Required (years)" // single number like "4" or range like "2–4"
- "Experience Level"            // "Fresher", "Experienced", or "Both"
- "Work Mode"                   // "Remote", "Onsite", "Hybrid" if mentioned
- "Work Location"               // if different from client city

Budget & salary:
- "Budget Range (INR/month)"    // e.g. "7000–15000"
- "Minimum Budget (INR/month)"  // if clear
- "Maximum Budget (INR/month)"  // if clear

Other useful HR info (only if clearly mentioned):
- "Required Skills / Tech Stack"
- "Notice Period / Joining Timeline"
- "Contract Type"              // "Full-time", "Contract", etc.
- "Shift Timing"
- "Other Notes"

RULES FOR FIELD NAMES:
- Field names MUST be short, clear **English labels** exactly like examples above.
- Do NOT invent random labels like "req_1", "data1".
- If the same info appears multiple times, merge it and give a single clean row.

RULES FOR VALUES:
- Keep the original meaning but **normalize**:
  - Numbers: "7 आदमी चाहिए" → "7"
  - Years: "4 year experience", "चार साल" → "4"
  - Budget: "7000 se 15000", "7-15k" → "7000–15000"
- Values can be Hindi or English mix, but should be clean and readable.
- If something is guessed or very uncertain, lower the confidence.

CATEGORY FIELD:
Use category for grouping:
- "client"      → client/contact related fields
- "role"        → position, experience level, skills
- "openings"    → counts of people
- "budget"      → salary / budget
- "location"    → any location/city details
- "meta"        → other helpful notes

OUTPUT FORMAT:
Return a JSON object with this exact shape:

{
  "rows": Array<{
    "field": string;      // e.g. "Client Name", "Position Title", "Total Openings"
    "value": string;      // extracted value, normalized
    "category": string;   // e.g. "client", "role", "openings", "budget", "location", "meta"
    "confidence": number; // between 0 and 1
    "snippet"?: string;   // small piece of original text where you found it
  }>
}

VERY IMPORTANT:
- If you cannot find a field, simply omit it (do NOT create empty rows).
- If you find no useful information, return { "rows": [] }.
- The response must be **valid JSON only**. No explanation, no comments, no backticks.
- Do NOT wrap JSON in markdown or text.
`;

  try {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://your-app-url.example", // optional
        "X-Title": "Speech PII + HR Requirement Extractor",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: text,
          },
        ],
        temperature: 0.1,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("OpenRouter error:", response.status, body);
    
      return NextResponse.json(
        {
          error: "Upstream model error",
          upstreamStatus: response.status,
          upstreamBody: body?.slice(0, 1200), // enough to see the real reason
        },
        { status: 500 }
      );
    }
    

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ??
      data?.choices?.[0]?.message?.content?.[0]?.text ??
      "";

    let parsed: { rows: PiiRow[] } = { rows: [] };

    try {
      const firstBrace = content.indexOf("{");
      const lastBrace = content.lastIndexOf("}");
      const jsonString =
        firstBrace !== -1 && lastBrace !== -1
          ? content.slice(firstBrace, lastBrace + 1)
          : content;

      parsed = JSON.parse(jsonString);
    } catch (e) {
      console.error("Failed to parse model JSON:", e, content);
      return NextResponse.json(
        {
          error: "Failed to parse PII output",
          raw: content,
        },
        { status: 500 }
      );
    }

    if (!parsed.rows || !Array.isArray(parsed.rows)) {
      parsed.rows = [];
    }

    return NextResponse.json({ rows: parsed.rows satisfies PiiRow[] });
  } catch (err) {
    console.error("PII route error:", err);
    return NextResponse.json(
      { error: "Unexpected server error" },
      { status: 500 }
    );
  }
}
