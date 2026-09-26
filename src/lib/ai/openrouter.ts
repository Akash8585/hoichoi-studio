type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function openRouterChat(messages: ChatMessage[], options?: {
  model?: string;
  temperature?: number;
  json?: boolean;
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model =
    options?.model ||
    process.env.OPENROUTER_TEXT_MODEL ||
    "openrouter/free";

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY missing");
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer":
        process.env.BETTER_AUTH_URL ||
        process.env.NEXTAUTH_URL ||
        "http://localhost:3000",
      "X-Title": "Hoichoi Content Studio",
    },
    body: JSON.stringify({
      model,
      temperature: options?.temperature ?? 0.7,
      messages,
      ...(options?.json
        ? { response_format: { type: "json_object" } }
        : {}),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenRouter returned empty content");
  return content;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Failed to parse model JSON");
  }
}
