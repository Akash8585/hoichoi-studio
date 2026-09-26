import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { PLATFORM_SPECS, type Channel } from "@/lib/platforms/specs";
import { validatePayload } from "@/lib/platforms/adapters";
import { parseJsonArray } from "@/lib/utils";
import { writeAudit } from "@/lib/security/audit";

export async function POST(req: Request) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const channel = (body.channel as Channel) || "x";
  const spec = PLATFORM_SPECS[channel];

  const pkg = await prisma.assetPackage.findFirst({
    where: { channel, status: { in: ["approved", "pending_approval", "draft"] } },
    orderBy: { updatedAt: "desc" },
  });

  const base = {
    channel,
    copyBn: pkg?.copyBn || "স্বাভাবিক বাংলা কপি",
    copyEn: pkg?.copyEn || "Normal English copy",
    title: pkg?.title || "Valid title",
    hashtags: parseJsonArray(pkg?.hashtags || "[]"),
    cta: pkg?.cta,
    imageUrl: pkg?.imageUrl || "https://invalid.example/image.jpg",
    imageWidth: spec.w,
    imageHeight: spec.h,
    imageBytes: 1000,
    videoUrl: pkg?.videoUrl || "https://invalid.example/video.mp4",
    videoWidth: spec.w,
    videoHeight: spec.h,
    videoBytes: 1000,
    videoDurationSec: 5,
  };
  const results = [
    {
      case: "character_limit",
      result: validatePayload({
        ...base,
        channel: "x",
        copyEn: "x".repeat(281),
        imageWidth: PLATFORM_SPECS.x.w,
        imageHeight: PLATFORM_SPECS.x.h,
        videoWidth: PLATFORM_SPECS.x.w,
        videoHeight: PLATFORM_SPECS.x.h,
      }),
    },
    {
      case: "wrong_aspect_ratio",
      result: validatePayload({
        ...base,
        imageWidth: spec.h,
        imageHeight: spec.w,
      }),
    },
    {
      case: "oversized_asset",
      result: validatePayload({
        ...base,
        imageBytes: spec.maxImageBytes + 1,
      }),
    },
  ];

  await writeAudit({
    userId: user!.id,
    action: "demo.reject_invalid",
    entityType: "Adapter",
    meta: results,
  });

  return NextResponse.json({ results });
}
