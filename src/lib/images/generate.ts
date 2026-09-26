import { PLATFORM_SPECS, type Channel } from "@/lib/platforms/specs";
import { putMediaObject } from "@/lib/storage";
import { MVP_MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { prisma } from "@/lib/db/prisma";
import sharp from "sharp";

const POLLINATIONS_GEN_BASE = "https://gen.pollinations.ai";

function svgForChannel(channel: Channel, title: string, prompt: string) {
  const spec = PLATFORM_SPECS[channel];
  const bg =
    channel === "instagram_reels"
      ? "#1a0f0a"
      : channel === "youtube_shorts"
        ? "#0b1220"
        : "#111827";
  const accent =
    channel === "instagram_reels"
      ? "#e85d04"
      : channel === "youtube_shorts"
        ? "#ef4444"
        : "#38bdf8";
  const safeTitle = title.replace(/[<>&]/g, "");
  const safePrompt = prompt.slice(0, 120).replace(/[<>&"]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${spec.w}" height="${spec.h}" viewBox="0 0 ${spec.w} ${spec.h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.55"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <circle cx="${Math.floor(spec.w * 0.7)}" cy="${Math.floor(spec.h * 0.28)}" r="${Math.floor(spec.w * 0.18)}" fill="${accent}" opacity="0.35"/>
  <text x="64" y="${Math.floor(spec.h * 0.42)}" fill="#f8fafc" font-size="64" font-family="Georgia, serif">${safeTitle.slice(0, 42)}</text>
  <text x="64" y="${Math.floor(spec.h * 0.48)}" fill="#e2e8f0" font-size="36" font-family="system-ui, sans-serif">${spec.label}</text>
  <text x="64" y="${Math.floor(spec.h * 0.55)}" fill="#cbd5e1" font-size="28" font-family="system-ui, sans-serif">${safePrompt}</text>
  <text x="64" y="${spec.h - 80}" fill="#94a3b8" font-size="28" font-family="system-ui, sans-serif">hoichoi Content Studio</text>
</svg>`;
}

export async function generateSvgImage(input: {
  channel: Channel;
  title: string;
  prompt: string;
  fileStem: string;
}) {
  const spec = PLATFORM_SPECS[input.channel];
  const svg = svgForChannel(input.channel, input.title, input.prompt);
  const stored = await putMediaObject({
    fileName: `${input.fileStem}.svg`,
    body: svg,
    contentType: "image/svg+xml",
    maxBytes: MVP_MAX_IMAGE_BYTES,
  });
  return {
    url: stored.url,
    width: spec.w,
    height: spec.h,
    bytes: stored.bytes,
    provider: "svg_fallback" as const,
    model: "channel-svg-v1",
    compliant: false,
  };
}

export async function generateCloudflareImage(input: {
  channel: Channel;
  prompt: string;
  fileStem: string;
}) {
  const accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !token) throw new Error("Cloudflare AI credentials missing");
  const model =
    process.env.CLOUDFLARE_IMAGE_MODEL ||
    "@cf/bytedance/stable-diffusion-xl-lightning";
  const spec = PLATFORM_SPECS[input.channel];
  const avoidMark = " Do not depict: ";
  const avoidAt = input.prompt.indexOf(avoidMark);
  const positive =
    avoidAt === -1 ? input.prompt : input.prompt.slice(0, avoidAt);
  const avoid =
    avoidAt === -1
      ? ""
      : input.prompt.slice(avoidAt + avoidMark.length).replace(/\.$/, "");
  const generationSize =
    input.channel === "x"
      ? { width: 1024, height: 1024 }
      : { width: 768, height: 1344 };
  const started = Date.now();
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "cf-aig-gateway-id":
            process.env.CLOUDFLARE_AI_GATEWAY_ID || "default",
        },
        signal: AbortSignal.timeout(45_000),
        body: JSON.stringify(
          model.includes("stable-diffusion")
            ? {
                prompt: positive,
                negative_prompt:
                  `text, letters, words, typography, title, logo, watermark, subtitles, captions, poster design, signage, deformed face, cropped face, blurry${avoid ? `, ${avoid}` : ""}`,
                width: generationSize.width,
                height: generationSize.height,
                num_steps: 4,
                guidance: 7.5,
              }
            : {
                prompt: positive,
                steps: 4,
              }
        ),
      }
    );
    if (!response.ok) {
      throw new Error(`${response.status}: ${(await response.text()).slice(0, 200)}`);
    }
    const contentType = response.headers.get("content-type") || "";
    let source: Buffer;
    if (contentType.includes("image/")) {
      source = Buffer.from(await response.arrayBuffer());
    } else {
      const payload = (await response.json()) as {
        result?: { image?: string } | string;
      };
      const encoded =
        typeof payload.result === "string"
          ? payload.result
          : payload.result?.image;
      if (!encoded) throw new Error("Cloudflare image response missing image");
      source = Buffer.from(encoded.replace(/^data:image\/\w+;base64,/, ""), "base64");
    }
    let buffer: Buffer;
    if (model.includes("stable-diffusion")) {
      buffer = await sharp(source)
        .resize(spec.w, spec.h, { fit: "cover", position: "attention" })
        .jpeg({ quality: 90 })
        .toBuffer();
    } else if (input.channel === "x") {
      buffer = await sharp(source)
        .resize(spec.w, spec.h, { fit: "cover", position: "attention" })
        .jpeg({ quality: 90 })
        .toBuffer();
    } else {
      const background = await sharp(source)
        .resize(spec.w, spec.h, { fit: "cover", position: "attention" })
        .blur(28)
        .modulate({ brightness: 0.62 })
        .toBuffer();
      const foreground = await sharp(source)
        .resize(spec.w, spec.w, { fit: "contain" })
        .jpeg({ quality: 92 })
        .toBuffer();
      buffer = await sharp(background)
        .composite([
          {
            input: foreground,
            left: 0,
            top: Math.round((spec.h - spec.w) / 2),
          },
        ])
        .jpeg({ quality: 90 })
        .toBuffer();
    }
    const stored = await putMediaObject({
      fileName: `${input.fileStem}.jpg`,
      body: buffer,
      contentType: "image/jpeg",
      maxBytes: MVP_MAX_IMAGE_BYTES,
    });
    await prisma.providerRun.create({
      data: {
        provider: "cloudflare-workers-ai",
        capability: "image",
        model,
        status: "success",
        latencyMs: Date.now() - started,
      },
    });
    return {
      url: stored.url,
      width: spec.w,
      height: spec.h,
      bytes: stored.bytes,
      provider: "cloudflare-workers-ai" as const,
      model,
      compliant: true,
    };
  } catch (error) {
    await prisma.providerRun
      .create({
        data: {
          provider: "cloudflare-workers-ai",
          capability: "image",
          model,
          status: "failed",
          latencyMs: Date.now() - started,
          error: (error as Error).message.slice(0, 500),
        },
      })
      .catch(() => undefined);
    throw error;
  }
}

export async function generatePollinationsImage(input: {
  channel: Channel;
  prompt: string;
  fileStem: string;
}) {
  const key = process.env.POLLINATIONS_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "POLLINATIONS_API_KEY missing. Get a secret key (sk_...) at https://enter.pollinations.ai/keys"
    );
  }

  const spec = PLATFORM_SPECS[input.channel];
  // Alias `flux` remains valid; catalog IDs use publisher/model (e.g. black-forest-labs/flux-schnell).
  const model = process.env.POLLINATIONS_IMAGE_MODEL || "flux";
  const encoded = encodeURIComponent(input.prompt.slice(0, 1000));
  const url = `${POLLINATIONS_GEN_BASE}/image/${encoded}?model=${encodeURIComponent(model)}&width=${spec.w}&height=${spec.h}&nologo=true`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) {
    throw new Error(`Pollinations image failed: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const stored = await putMediaObject({
    fileName: `${input.fileStem}.jpg`,
    body: buf,
    contentType: "image/jpeg",
    maxBytes: MVP_MAX_IMAGE_BYTES,
  });
  return {
    url: stored.url,
    width: spec.w,
    height: spec.h,
    bytes: stored.bytes,
    provider: "pollinations" as const,
    model,
    compliant: true,
  };
}

export async function generateChannelImage(input: {
  channel: Channel;
  title: string;
  prompt: string;
  fileStem: string;
}) {
  try {
    if (process.env.IMAGE_PROVIDER !== "pollinations_only") {
      return await generateCloudflareImage(input);
    }
  } catch {
    try {
      if (process.env.IMAGE_PROVIDER !== "cloudflare_only") {
        return await generatePollinationsImage(input);
      }
    } catch {
      // A placeholder is honest and cannot pass the approval gate.
    }
  }
  return generateSvgImage(input);
}
