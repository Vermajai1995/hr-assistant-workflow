import { getOptionalEnv, getRequiredEnv } from "@/lib/server/env";
import { log } from "@/lib/server/logger";

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function requestOpenRouter(messages: ChatMessage[], options?: { temperature?: number; maxTokens?: number; origin?: string }) {
  const apiKey = getRequiredEnv("OPENROUTER_API_KEY");
  const model = getOptionalEnv("OPENROUTER_MODEL", "openai/gpt-4.1-mini");
  const baseUrl = getOptionalEnv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1");

  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": options?.origin || "http://localhost:3000",
          "X-Title": "HireFlow",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.1,
          max_tokens: options?.maxTokens ?? 1400,
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        lastError = new Error(`OpenRouter error ${response.status}: ${body.slice(0, 800)}`);
        if (response.status === 429 || response.status >= 500) {
          await wait(250 * (attempt + 1));
          continue;
        }
        throw lastError;
      }

      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;

      if (typeof content === "string") {
        return content;
      }

      if (Array.isArray(content)) {
        const firstText = content.find((item) => item?.type === "text")?.text;
        if (typeof firstText === "string") {
          return firstText;
        }
      }

      throw new Error("OpenRouter returned an empty response.");
    } catch (error) {
      lastError = error;
      if (attempt === 2) {
        break;
      }
      await wait(250 * (attempt + 1));
    }
  }

  log("error", "OpenRouter request failed", {
    error: lastError instanceof Error ? lastError.message : String(lastError),
  });
  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed.");
}

export function parseJsonResponse<T>(raw: string): T {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");

  const candidate =
    firstBrace !== -1 && lastBrace !== -1
      ? raw.slice(firstBrace, lastBrace + 1)
      : firstBracket !== -1 && lastBracket !== -1
      ? raw.slice(firstBracket, lastBracket + 1)
      : raw;

  return JSON.parse(candidate.replace(/```json|```/g, "").trim()) as T;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
