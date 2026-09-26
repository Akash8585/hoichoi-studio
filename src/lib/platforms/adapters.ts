import {
  CHANNELS,
  PLATFORM_SPECS,
  type Channel,
  type PlatformSpec,
} from "@/lib/platforms/specs";
import { mediaUrlReachable } from "@/lib/storage";
import { parseJsonArray } from "@/lib/utils";
import sharp from "sharp";
import * as MP4Box from "mp4box";

export type PublishPayload = {
  channel: Channel;
  copyBn?: string | null;
  copyEn?: string | null;
  title?: string | null;
  hashtags: string[] | string;
  cta?: string | null;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  imageBytes?: number | null;
  videoUrl?: string | null;
  videoWidth?: number | null;
  videoHeight?: number | null;
  videoBytes?: number | null;
  videoDurationSec?: number | null;
};

export type AdapterResult =
  | {
      ok: true;
      externalMockId: string;
      checks: string[];
    }
  | {
      ok: false;
      reason: string;
      checks: string[];
    };

function dimsMatch(spec: PlatformSpec, w?: number | null, h?: number | null) {
  if (!w || !h) return false;
  const ratio = w / h;
  const expected = spec.w / spec.h;
  return Math.abs(ratio - expected) < 0.05;
}

export function validatePayload(payload: PublishPayload): AdapterResult {
  const checks: string[] = [];
  const spec = PLATFORM_SPECS[payload.channel];
  if (!spec) {
    return { ok: false, reason: "Unknown channel", checks };
  }

  const hashtags = Array.isArray(payload.hashtags)
    ? payload.hashtags
    : parseJsonArray(payload.hashtags);

  if (payload.channel === "x") {
    checks.push("x_text_length");
    const copies = [payload.copyEn, payload.copyBn].filter(
      (copy): copy is string => Boolean(copy)
    );
    const longest = Math.max(0, ...copies.map((copy) => copy.trim().length));
    if (longest > (spec.maxText ?? 280)) {
      return {
        ok: false,
        reason: `X text exceeds ${spec.maxText} characters (${longest})`,
        checks,
      };
    }
  }

  if (payload.channel === "instagram_reels") {
    const caption = `${payload.copyBn ?? ""}\n${payload.copyEn ?? ""}`.trim();
    checks.push("ig_caption_length");
    if (caption.length > (spec.maxCaption ?? 2200)) {
      return {
        ok: false,
        reason: `Instagram caption exceeds ${spec.maxCaption} characters`,
        checks,
      };
    }
  }

  if (payload.channel === "youtube_shorts") {
    checks.push("yt_title_length");
    if ((payload.title ?? "").length > (spec.maxTitle ?? 100)) {
      return {
        ok: false,
        reason: `YouTube title exceeds ${spec.maxTitle} characters`,
        checks,
      };
    }
    checks.push("yt_description_length");
    const longestDescription = Math.max(
      (payload.copyBn || "").length,
      (payload.copyEn || "").length
    );
    if (longestDescription > (spec.maxDesc ?? 5000)) {
      return {
        ok: false,
        reason: `YouTube description exceeds ${spec.maxDesc} characters`,
        checks,
      };
    }
  }

  checks.push("hashtag_count");
  if (hashtags.length > spec.maxHashtags) {
    return {
      ok: false,
      reason: `Too many hashtags (${hashtags.length} > ${spec.maxHashtags})`,
      checks,
    };
  }

  checks.push("image_present");
  if (!payload.imageUrl) {
    return { ok: false, reason: "Missing image asset", checks };
  }

  checks.push("image_aspect");
  if (!dimsMatch(spec, payload.imageWidth, payload.imageHeight)) {
    return {
      ok: false,
      reason: `Image aspect must be ${spec.aspect} (got ${payload.imageWidth}x${payload.imageHeight})`,
      checks,
    };
  }

  checks.push("image_bytes");
  if ((payload.imageBytes ?? 0) > spec.maxImageBytes) {
    return {
      ok: false,
      reason: `Image exceeds max bytes (${payload.imageBytes} > ${spec.maxImageBytes})`,
      checks,
    };
  }

  if (spec.video.required) {
    checks.push("video_present");
    if (!payload.videoUrl) {
      return { ok: false, reason: "Missing video asset", checks };
    }
    checks.push("video_aspect");
    if (!dimsMatch(spec, payload.videoWidth, payload.videoHeight)) {
      return {
        ok: false,
        reason: `Video aspect must be ${spec.video.aspect} (got ${payload.videoWidth}x${payload.videoHeight})`,
        checks,
      };
    }
    checks.push("video_duration");
    if ((payload.videoDurationSec ?? 0) > spec.video.maxDurationSec) {
      return {
        ok: false,
        reason: `Video duration exceeds ${spec.video.maxDurationSec}s`,
        checks,
      };
    }
    checks.push("video_bytes");
    if ((payload.videoBytes ?? 0) > spec.video.maxBytes) {
      return {
        ok: false,
        reason: `Video exceeds max bytes`,
        checks,
      };
    }
  }

  const externalMockId = `mock_${payload.channel}_${Date.now().toString(36)}`;
  return { ok: true, externalMockId, checks };
}

export async function publishToMockAdapter(
  payload: PublishPayload
): Promise<AdapterResult> {
  const result = validatePayload(payload);
  if (!result.ok) {
    return result;
  }

  const checks = [...result.checks, "image_reachable"];
  if (!(await mediaUrlReachable(payload.imageUrl))) {
    return {
      ok: false,
      reason: "Image asset URL is unreachable",
      checks,
    };
  }
  try {
    checks.push("image_content_type", "image_actual_bytes", "image_actual_dimensions");
    const image = await fetchMedia(payload.imageUrl!, specFor(payload.channel).maxImageBytes);
    if (!image.contentType.startsWith("image/")) {
      return { ok: false, reason: `Image MIME is ${image.contentType}`, checks };
    }
    const metadata = await inspectImageBuffer(image.buffer);
    if (
      !dimsMatch(
        specFor(payload.channel),
        metadata.width,
        metadata.height
      )
    ) {
      return {
        ok: false,
        reason: `Actual image dimensions violate ${specFor(payload.channel).aspect}`,
        checks,
      };
    }
  } catch (error) {
    return {
      ok: false,
      reason: `Image inspection failed: ${(error as Error).message}`,
      checks,
    };
  }

  const spec = PLATFORM_SPECS[payload.channel];
  if (spec.video.required) {
    checks.push("video_reachable");
    if (!(await mediaUrlReachable(payload.videoUrl))) {
      return {
        ok: false,
        reason: "Video asset URL is unreachable",
        checks,
      };
    }
    try {
      checks.push(
        "video_content_type",
        "video_actual_bytes",
        "video_actual_dimensions",
        "video_actual_duration"
      );
      const video = await fetchMedia(payload.videoUrl!, spec.video.maxBytes);
      if (!video.contentType.includes("video/mp4")) {
        return { ok: false, reason: `Video MIME is ${video.contentType}`, checks };
      }
      const metadata = await inspectMp4(video.buffer);
      if (!dimsMatch(spec, metadata.width, metadata.height)) {
        return {
          ok: false,
          reason: `Actual video dimensions ${metadata.width}x${metadata.height} violate ${spec.video.aspect}`,
          checks,
        };
      }
      if (metadata.durationSec > spec.video.maxDurationSec) {
        return {
          ok: false,
          reason: `Actual video duration ${metadata.durationSec.toFixed(1)}s exceeds ${spec.video.maxDurationSec}s`,
          checks,
        };
      }
    } catch (error) {
      return {
        ok: false,
        reason: `Video inspection failed: ${(error as Error).message}`,
        checks,
      };
    }
  }

  return { ...result, checks };
}

function specFor(channel: Channel) {
  return PLATFORM_SPECS[channel];
}

async function fetchMedia(url: string, maxBytes: number) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
    headers: { Range: `bytes=0-${maxBytes}` },
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`HTTP ${response.status}`);
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new Error(`${declared} bytes exceeds ${maxBytes}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error(`${buffer.byteLength} bytes exceeds ${maxBytes}`);
  }
  return {
    buffer,
    contentType: (response.headers.get("content-type") || "").split(";")[0],
  };
}

export async function inspectImageBuffer(buffer: Buffer) {
  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image has no dimensions");
  }
  return { width: metadata.width, height: metadata.height };
}

export async function inspectMp4(buffer: Buffer): Promise<{
  width: number;
  height: number;
  durationSec: number;
}> {
  if (
    buffer.byteLength < 64 ||
    !buffer.subarray(0, Math.min(buffer.length, 64)).includes(Buffer.from("ftyp"))
  ) {
    throw new Error("Invalid MP4 header");
  }
  return new Promise((resolve, reject) => {
    const file = MP4Box.createFile();
    file.onError = (error: string) => reject(new Error(error));
    file.onReady = (info: {
      duration: number;
      timescale: number;
      videoTracks: Array<{
        video?: { width?: number; height?: number };
        track_width?: number;
        track_height?: number;
      }>;
    }) => {
      const track = info.videoTracks?.[0];
      if (!track) return reject(new Error("MP4 has no video track"));
      resolve({
        width: track.video?.width || track.track_width || 0,
        height: track.video?.height || track.track_height || 0,
        durationSec: info.timescale ? info.duration / info.timescale : 0,
      });
    };
    const bytes = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength
    ) as ArrayBuffer & { fileStart: number };
    bytes.fileStart = 0;
    file.appendBuffer(bytes as Parameters<typeof file.appendBuffer>[0]);
    file.flush();
  });
}

export function isChannel(value: string): value is Channel {
  return (CHANNELS as string[]).includes(value);
}
