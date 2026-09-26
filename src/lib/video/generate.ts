/**
 * Isolated video providers for a later release. Image Studio never calls
 * generateChannelVideo; keep this module out of the active user flow.
 */
import { PLATFORM_SPECS, type Channel } from "@/lib/platforms/specs";
import { putMediaObject } from "@/lib/storage";
import { MVP_MAX_VIDEO_BYTES } from "@/lib/storage/limits";
import { prisma } from "@/lib/db/prisma";

const POLLINATIONS_GEN_BASE = "https://gen.pollinations.ai";
let cachedVideoModels: { ids: Set<string>; expiresAt: number } | null = null;

async function healthyVideoModels(candidates: string[]) {
  if (cachedVideoModels && cachedVideoModels.expiresAt > Date.now()) {
    const filtered = candidates.filter((model) => cachedVideoModels!.ids.has(model));
    return filtered.length ? filtered : candidates;
  }
  try {
    const response = await fetch(`${POLLINATIONS_GEN_BASE}/video/models`, {
      headers: process.env.POLLINATIONS_API_KEY
        ? { Authorization: `Bearer ${process.env.POLLINATIONS_API_KEY}` }
        : {},
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return candidates;
    const payload = (await response.json()) as
      | Array<{ id?: string; name?: string; paid_only?: boolean; healthy?: boolean }>
      | { models?: Array<{ id?: string; name?: string; paid_only?: boolean; healthy?: boolean }> };
    const rows = Array.isArray(payload) ? payload : payload.models || [];
    const ids = new Set(
      rows
        .filter((row) => row.healthy !== false)
        .flatMap((row) => [row.id, row.name].filter(Boolean) as string[])
    );
    cachedVideoModels = { ids, expiresAt: Date.now() + 10 * 60 * 1000 };
    const filtered = candidates.filter((model) => ids.has(model));
    return filtered.length ? filtered : candidates;
  } catch {
    return candidates;
  }
}

function validMp4(buffer: Buffer, contentType: string) {
  return (
    contentType.includes("video") &&
    buffer.byteLength >= 10_000 &&
    buffer
      .subarray(0, Math.min(buffer.length, 64))
      .includes(Buffer.from("ftyp"))
  );
}

export async function generateCloudflareVideo(input: {
  channel: Channel;
  prompt: string;
  fileStem: string;
}) {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new Error("Cloudflare AI credentials missing");
  const model =
    process.env.CLOUDFLARE_VIDEO_MODEL || "google/veo-3.1-fast";
  const spec = PLATFORM_SPECS[input.channel];
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "cf-aig-gateway-id":
          process.env.CLOUDFLARE_AI_GATEWAY_ID || "default",
      },
      signal: AbortSignal.timeout(170_000),
      body: JSON.stringify({
        model,
        input: {
          prompt: input.prompt,
          aspect_ratio: spec.video.aspect,
          duration: "4s",
          resolution: "720p",
          generate_audio: false,
        },
      }),
    }
  );
  if (!response.ok) {
    throw new Error(`Cloudflare video failed: ${response.status} ${(await response.text()).slice(0, 200)}`);
  }
  const payload = (await response.json()) as {
    result?: { video?: string };
    state?: string;
  };
  const sourceUrl = payload.result?.video;
  if (!sourceUrl) {
    throw new Error(`Cloudflare video incomplete (${payload.state || "unknown"})`);
  }
  const media = await fetch(sourceUrl, { signal: AbortSignal.timeout(60_000) });
  if (!media.ok) throw new Error(`Cloudflare video download failed: ${media.status}`);
  const contentType = media.headers.get("content-type") || "";
  const buffer = Buffer.from(await media.arrayBuffer());
  if (!validMp4(buffer, contentType)) throw new Error("Cloudflare returned invalid MP4");
  const stored = await putMediaObject({
    fileName: `${input.fileStem}.mp4`,
    body: buffer,
    contentType: "video/mp4",
    maxBytes: MVP_MAX_VIDEO_BYTES,
  });
  return {
    url: stored.url,
    width: spec.w,
    height: spec.h,
    bytes: stored.bytes,
    durationSec: 4,
    provider: "cloudflare-ai-gateway" as const,
    model,
  };
}

export async function generatePollinationsVideo(input: {
  channel: Channel;
  prompt: string;
  fileStem: string;
  model: string;
}) {
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "POLLINATIONS_API_KEY missing. Get a secret key (sk_...) at https://enter.pollinations.ai/keys"
    );
  }

  const spec = PLATFORM_SPECS[input.channel];
  const model = input.model;
  const encoded = encodeURIComponent(input.prompt.slice(0, 400));
  const aspect = spec.video.aspect;
  const url = `${POLLINATIONS_GEN_BASE}/video/${encoded}?model=${encodeURIComponent(model)}&duration=5&aspectRatio=${encodeURIComponent(aspect)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(110_000),
  });
  if (!res.ok) {
    throw new Error(`Pollinations video failed: ${res.status} ${(await res.text()).slice(0, 120)}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "";
  if (!validMp4(buf, contentType)) {
    throw new Error(
      `Invalid video response (${contentType || "unknown"}, ${buf.byteLength} bytes)`
    );
  }
  const stored = await putMediaObject({
    fileName: `${input.fileStem}.mp4`,
    body: buf,
    contentType: "video/mp4",
    maxBytes: MVP_MAX_VIDEO_BYTES,
  });
  return {
    url: stored.url,
    width: spec.w,
    height: spec.h,
    bytes: stored.bytes,
    durationSec: 5,
    provider: "pollinations" as const,
    model,
  };
}

export async function generateChannelVideo(input: {
  channel: Channel;
  title: string;
  prompt: string;
  imageUrl?: string | null;
  fileStem: string;
}) {
  const videoProvider = process.env.VIDEO_PROVIDER || "cloudflare_then_pollinations";
  if (
    shouldUseCloudflareVideo({
      CLOUDFLARE_UNIFIED_BILLING:
        process.env.CLOUDFLARE_UNIFIED_BILLING,
      VIDEO_PROVIDER: process.env.VIDEO_PROVIDER,
    })
  ) {
    const cloudflareStarted = Date.now();
    try {
      const result = await generateCloudflareVideo(input);
      await prisma.providerRun.create({
        data: {
          provider: result.provider,
          capability: "video",
          model: result.model,
          status: "success",
          latencyMs: Date.now() - cloudflareStarted,
        },
      });
      return result;
    } catch (error) {
      await prisma.providerRun
        .create({
          data: {
            provider: "cloudflare-ai-gateway",
            capability: "video",
            model: process.env.CLOUDFLARE_VIDEO_MODEL || "google/veo-3.1-fast",
            status: "failed",
            latencyMs: Date.now() - cloudflareStarted,
            error: (error as Error).message.slice(0, 500),
          },
        })
        .catch(() => undefined);
    }
  }

  if (videoProvider === "cloudflare_only") {
    throw new Error("Cloudflare video unavailable and VIDEO_PROVIDER forbids fallback");
  }

  const configuredModels = [
    process.env.POLLINATIONS_VIDEO_MODEL,
    "bytedance/seedance-1-pro-fast",
    "alibaba/wan-2.2-fast",
  ].filter((model, index, all): model is string => Boolean(model) && all.indexOf(model) === index);
  const models =
    videoProvider === "ffmpeg_only"
      ? []
      : await healthyVideoModels(configuredModels);
  const errors: string[] = [];
  for (const model of models) {
    const started = Date.now();
    try {
      // Identical first retry allows Pollinations to return the cached in-flight result.
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const result = await generatePollinationsVideo({ ...input, model });
          await prisma.providerRun.create({
            data: {
              provider: "pollinations",
              capability: "video",
              model,
              status: "success",
              latencyMs: Date.now() - started,
            },
          });
          return result;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
    } catch (error) {
      errors.push(`${model}: ${(error as Error).message}`);
      await prisma.providerRun
        .create({
          data: {
            provider: "pollinations",
            capability: "video",
            model,
            status: "failed",
            latencyMs: Date.now() - started,
            error: (error as Error).message.slice(0, 500),
          },
        })
        .catch(() => undefined);
    }
  }
  throw new Error(`No playable video generated: ${errors.join(" | ")}`);
}

export function shouldUseCloudflareVideo(
  env: {
    CLOUDFLARE_UNIFIED_BILLING?: string;
    VIDEO_PROVIDER?: string;
  }
) {
  return (
    env.CLOUDFLARE_UNIFIED_BILLING === "true" &&
    (env.VIDEO_PROVIDER || "cloudflare_then_pollinations") !== "pollinations_only"
  );
}
