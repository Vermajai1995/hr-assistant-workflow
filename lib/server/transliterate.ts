import { parseJsonResponse, requestOpenRouter } from "@/lib/server/openrouter";

export async function transliterateValues(values: string[], origin?: string) {
  const prompt = `
Transliterate the following Hindi or Hinglish values into clean English Latin letters.
Do not translate meaning.
Return a JSON array in the same order.

Values:
${values.map((value, index) => `${index + 1}. ${value}`).join("\n")}
`;

  const raw = await requestOpenRouter(
    [{ role: "user", content: prompt }],
    { origin, maxTokens: 900, temperature: 0.1 }
  );

  const result = parseJsonResponse<string[]>(raw);
  return Array.isArray(result) ? result : [];
}
