import { describe, expect, it } from "vitest";
import {
  publishToMockAdapter,
  validatePayload,
  inspectImageBuffer,
  inspectMp4,
} from "@/lib/platforms/adapters";
import { canTransition, imageAssetsReady } from "@/lib/domain/status";
import { METRIC_SOURCE, seedMetrics } from "@/lib/insights/metrics";
import { PLATFORM_SPECS } from "@/lib/platforms/specs";
import { assertWithinLimit } from "@/lib/storage";
import { MVP_MAX_IMAGE_BYTES } from "@/lib/storage/limits";
import { evaluateGenerationQuality } from "@/lib/ai/quality";
import { fallbackPackages } from "@/lib/ai/prompts";
import { validateReportClaims } from "@/lib/insights/report";
import sharp from "sharp";
import { shouldUseCloudflareVideo } from "@/lib/video/generate";
import { workflowStep } from "@/lib/domain/workflow";

describe("adapters", () => {
  it("rejects real character, aspect and byte violations", () => {
    const bad = validatePayload({
      channel: "x",
      copyEn: "x".repeat(281),
      hashtags: ["#a"],
      imageUrl: "/x.jpg",
      imageWidth: 1080,
      imageHeight: 1080,
      imageBytes: 1000,
      videoUrl: "/x.mp4",
      videoWidth: 1080,
      videoHeight: 1080,
      videoBytes: 1000,
      videoDurationSec: 5,
    });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.reason).toMatch(/exceeds 280/i);

    const wrongAspect = validatePayload({
      channel: "instagram_reels",
      copyEn: "ok",
      hashtags: [],
      imageUrl: "/ig.jpg",
      imageWidth: 1920,
      imageHeight: 1080,
      imageBytes: 1000,
      videoUrl: "/ig.mp4",
      videoWidth: 1080,
      videoHeight: 1920,
      videoBytes: 1000,
      videoDurationSec: 5,
    });
    expect(wrongAspect.ok).toBe(false);

    const oversized = validatePayload({
      channel: "x",
      copyEn: "ok",
      hashtags: [],
      imageUrl: "/x.jpg",
      imageWidth: 1080,
      imageHeight: 1080,
      imageBytes: PLATFORM_SPECS.x.maxImageBytes + 1,
      videoUrl: "/x.mp4",
      videoWidth: 1080,
      videoHeight: 1080,
      videoBytes: 1000,
      videoDurationSec: 5,
    });
    expect(oversized.ok).toBe(false);
  });

  it("accepts structurally valid metadata", () => {
    const good = validatePayload({
      channel: "instagram_reels",
      copyBn: "হ্যালো",
      copyEn: "Hello",
      hashtags: ["#hoichoi"],
      imageUrl: "/ig.jpg",
      imageWidth: PLATFORM_SPECS.instagram_reels.w,
      imageHeight: PLATFORM_SPECS.instagram_reels.h,
      imageBytes: 10000,
      videoUrl: "/ig.mp4",
      videoWidth: PLATFORM_SPECS.instagram_reels.w,
      videoHeight: PLATFORM_SPECS.instagram_reels.h,
      videoBytes: 20000,
      videoDurationSec: 5,
    });
    expect(good.ok).toBe(true);
  });

  it("accepts image-only payloads when video is not required", () => {
    const res = validatePayload({
      channel: "youtube_shorts",
      title: "Title",
      copyEn: "desc",
      hashtags: [],
      imageUrl: "/yt.jpg",
      imageWidth: 1080,
      imageHeight: 1920,
      imageBytes: 1000,
      videoUrl: null,
    });
    expect(res.ok).toBe(true);
  });

  it("still hard-rejects invalid images and copy", () => {
    const missingImage = validatePayload({
      channel: "x",
      copyEn: "ok",
      hashtags: [],
      imageUrl: null,
      imageWidth: 1080,
      imageHeight: 1080,
      imageBytes: 1000,
    });
    expect(missingImage.ok).toBe(false);
    if (!missingImage.ok) expect(missingImage.reason).toMatch(/Missing image/i);
  });

  it("rejects unreachable media URLs", async () => {
    const res = await publishToMockAdapter({
      channel: "instagram_reels",
      copyBn: "হ্যালো",
      copyEn: "Hello",
      hashtags: ["#hoichoi"],
      imageUrl: "/generated/does-not-exist.jpg",
      imageWidth: PLATFORM_SPECS.instagram_reels.w,
      imageHeight: PLATFORM_SPECS.instagram_reels.h,
      imageBytes: 10000,
      videoUrl: "/generated/does-not-exist.mp4",
      videoWidth: PLATFORM_SPECS.instagram_reels.w,
      videoHeight: PLATFORM_SPECS.instagram_reels.h,
      videoBytes: 20000,
      videoDurationSec: 5,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/unreachable/i);
  });

  it("probes actual image dimensions and rejects invalid MP4 bytes", async () => {
    const image = await sharp({
      create: {
        width: 320,
        height: 180,
        channels: 3,
        background: "#111827",
      },
    })
      .png()
      .toBuffer();
    await expect(inspectImageBuffer(image)).resolves.toEqual({
      width: 320,
      height: 180,
    });
    await expect(inspectMp4(Buffer.from("not-an-mp4"))).rejects.toThrow();
  });
});

describe("storage limits", () => {
  it("throws when over MVP image cap", () => {
    expect(() =>
      assertWithinLimit(MVP_MAX_IMAGE_BYTES + 1, MVP_MAX_IMAGE_BYTES, "img")
    ).toThrow(/size limit/i);
  });
});

describe("status machine", () => {
  it("blocks schedule-equivalent approve from draft", () => {
    expect(canTransition("draft", "approved")).toBe(false);
    expect(canTransition("pending_approval", "approved")).toBe(true);
  });

  it("requires a compliant image and passing quality checks", () => {
    expect(
      imageAssetsReady({
        imageStatus: "ready",
        imageProvider: "cloudflare-workers-ai",
        qualityChecks: JSON.stringify({ passed: true }),
      })
    ).toBe(true);
    expect(
      imageAssetsReady({
        imageStatus: "ready",
        imageProvider: "cloudflare-workers-ai",
        qualityChecks: JSON.stringify({ passed: false }),
      })
    ).toBe(false);
    expect(
      imageAssetsReady({
        imageStatus: "ready",
        imageProvider: "svg_fallback",
        qualityChecks: JSON.stringify({ passed: true }),
      })
    ).toBe(false);
  });
});

describe("metrics", () => {
  it("is deterministic for same post id and labeled simulated", () => {
    expect(METRIC_SOURCE).toBe("simulated");
    expect(seedMetrics("abc")).toEqual(seedMetrics("abc"));
    expect(seedMetrics("abc")).not.toEqual(seedMetrics("xyz"));
  });
});

describe("generation quality", () => {
  it("checks native Bengali and channel differences", () => {
    const quality = evaluateGenerationQuality(fallbackPackages("পরীক্ষা"));
    expect(quality.hasThreeChannels).toBe(true);
    expect(quality.nativeBengali).toBe(true);
    expect(quality.uniqueVisualDirections).toBe(true);
  });

  it("enforces brief-specific include and avoid constraints", () => {
    const packs = fallbackPackages("পরীক্ষা");
    packs[0].copyBn += " নীল ছাতা";
    const quality = evaluateGenerationQuality(packs, {
      briefBody: "নীল ছাতা নিয়ে একটি রহস্যময় গল্প",
      mustInclude: ["নীল ছাতা"],
      mustAvoid: ["funeral"],
    });
    expect(quality.requiredTermsPresent).toBe(true);
    expect(quality.forbiddenTermsAbsent).toBe(true);
    expect(quality.briefAdherence).toBe(true);
  });
});

describe("provider routing", () => {
  it("skips Veo when Unified Billing is disabled", () => {
    expect(
      shouldUseCloudflareVideo({
        CLOUDFLARE_UNIFIED_BILLING: "false",
        VIDEO_PROVIDER: "cloudflare_then_pollinations",
      })
    ).toBe(false);
    expect(
      shouldUseCloudflareVideo({
        CLOUDFLARE_UNIFIED_BILLING: "true",
        VIDEO_PROVIDER: "cloudflare_then_pollinations",
      })
    ).toBe(true);
  });
});

describe("workflow stages", () => {
  it("derives the same campaign stage used throughout the UI", () => {
    expect(workflowStep([])).toBe(0);
    expect(workflowStep([{ status: "pending_approval" }])).toBe(2);
    expect(workflowStep([{ status: "approved" }])).toBe(3);
    expect(
      workflowStep([{ status: "approved", posts: [{ status: "published" }] }])
    ).toBe(5);
    expect(
      workflowStep([
        { status: "approved", posts: [{ status: "published", metrics: [{ id: "m1" }] }] },
      ])
    ).toBe(7);
  });
});

describe("report citations", () => {
  it("accepts only claims with known post evidence", () => {
    expect(
      validateReportClaims(
        {
          claims: [
            {
              claim: "Instagram won on engagement.",
              evidencePostIds: ["post-1"],
            },
          ],
        },
        new Set(["post-1"])
      )
    ).toHaveLength(1);
    expect(() =>
      validateReportClaims(
        {
          claims: [
            {
              claim: "An unsupported claim.",
              evidencePostIds: ["unknown"],
            },
          ],
        },
        new Set(["post-1"])
      )
    ).toThrow(/unknown or missing evidence/i);
  });
});
