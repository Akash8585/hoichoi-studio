import { prisma } from "@/lib/db/prisma";

export type AiMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StructuredResult<T> = {
  data: T;
  provider: string;
  model: string;
  latencyMs: number;
};

type Candidate = {
  provider: string;
  model: string;
  url: string;
  headers: Record<string, string>;
  extraBody?: Record<string, unknown>;
  jsonObjectOnly?: boolean;
};

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("Model returned output that was not JSON");
  }
}

async function recordRun(input: {
  provider: string;
  capability: string;
  model: string;
  status: string;
  latencyMs: number;
  error?: string;
}) {
  try {
    await prisma.providerRun.create({ data: input });
  } catch {
    // Observability must not take down generation.
  }
}

function candidates(): Candidate[] {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || "";
  const cfToken = process.env.CLOUDFLARE_API_TOKEN || "";
  const gatewayId = process.env.CLOUDFLARE_AI_GATEWAY_ID || "default";
  const cloudflareUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;
  const cfHeaders = {
    Authorization: `Bearer ${cfToken}`,
    "Content-Type": "application/json",
    "cf-aig-gateway-id": gatewayId,
  };

  const list: Candidate[] = [];
  if (accountId && cfToken) {
    if (process.env.CLOUDFLARE_UNIFIED_BILLING === "true") {
      list.push({
        provider: "cloudflare-ai-gateway",
        model:
          process.env.CLOUDFLARE_TEXT_MODEL || "google/gemini-3-flash",
        url: cloudflareUrl,
        headers: cfHeaders,
      });
    }
    list.push({
      provider: "cloudflare-workers-ai",
      model:
        process.env.CLOUDFLARE_WORKERS_TEXT_MODEL ||
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
      url: cloudflareUrl,
      headers: cfHeaders,
      jsonObjectOnly: true,
    });
    if (
      (process.env.CLOUDFLARE_WORKERS_TEXT_MODEL ||
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast") !==
      "@cf/zai-org/glm-4.7-flash"
    ) {
      list.push({
        provider: "cloudflare-workers-ai",
        model: "@cf/zai-org/glm-4.7-flash",
        url: cloudflareUrl,
        headers: cfHeaders,
        jsonObjectOnly: true,
      });
    }
  }

  if (process.env.OPENROUTER_API_KEY) {
    list.push({
      provider: "openrouter",
      model:
        process.env.OPENROUTER_TEXT_MODEL || "qwen/qwen3.8-27b:free",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.BETTER_AUTH_URL || "http://localhost:3000",
        "X-Title": "Hoichoi Content Studio",
      },
      extraBody: { provider: { require_parameters: true } },
    });
  }
  return list;
}

export async function generateStructured<T>(input: {
  messages: AiMessage[];
  schemaName: string;
  schema: Record<string, unknown>;
  validate: (value: unknown) => T;
  temperature?: number;
}): Promise<StructuredResult<T>> {
  const errors: string[] = [];
  for (const candidate of candidates()) {
    const started = Date.now();
    try {
      const response = await fetch(candidate.url, {
        method: "POST",
        headers: candidate.headers,
        signal: AbortSignal.timeout(35_000),
        body: JSON.stringify({
          model: candidate.model,
          messages: candidate.jsonObjectOnly
            ? [
                {
                  role: "system",
                  content: `Return ONLY one JSON object that exactly follows this schema. Do not add markdown or commentary:\n${JSON.stringify(
                    input.schema
                  )}`,
                },
                ...input.messages,
              ]
            : input.messages,
          temperature: input.temperature ?? 0.55,
          max_tokens: 4096,
          response_format: candidate.jsonObjectOnly
            ? { type: "json_object" }
            : {
                type: "json_schema",
                json_schema: {
                  name: input.schemaName,
                  strict: true,
                  schema: input.schema,
                },
              },
          ...candidate.extraBody,
        }),
      });
      if (!response.ok) {
        throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = payload.choices?.[0]?.message?.content;
      if (!content) throw new Error("Empty completion");
      const data = input.validate(parseJson(content));
      const latencyMs = Date.now() - started;
      await recordRun({
        provider: candidate.provider,
        capability: "text",
        model: candidate.model,
        status: "success",
        latencyMs,
      });
      return { data, provider: candidate.provider, model: candidate.model, latencyMs };
    } catch (error) {
      const latencyMs = Date.now() - started;
      const message = (error as Error).message;
      errors.push(`${candidate.provider}/${candidate.model}: ${message}`);
      await recordRun({
        provider: candidate.provider,
        capability: "text",
        model: candidate.model,
        status: "failed",
        latencyMs,
        error: message.slice(0, 500),
      });
    }
  }
  throw new Error(`All text providers failed: ${errors.join(" | ") || "no configured providers"}`);
}

