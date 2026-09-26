import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { assertTransition, imageAssetsReady } from "@/lib/domain/status";
import { writeAudit } from "@/lib/security/audit";
import { publishToMockAdapter } from "@/lib/platforms/adapters";
import { parseJsonArray } from "@/lib/utils";
import type { Channel } from "@/lib/platforms/specs";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const pkg = await prisma.assetPackage.findUnique({ where: { id } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!imageAssetsReady(pkg)) {
    return NextResponse.json(
      { error: "A compliant image and passing quality checks are required before approval" },
      { status: 422 }
    );
  }
  const preflight = await publishToMockAdapter({
    channel: pkg.channel as Channel,
    copyBn: pkg.copyBn,
    copyEn: pkg.copyEn,
    title: pkg.title,
    hashtags: parseJsonArray(pkg.hashtags),
    cta: pkg.cta,
    imageUrl: pkg.imageUrl,
    imageWidth: pkg.imageWidth,
    imageHeight: pkg.imageHeight,
    imageBytes: pkg.imageBytes,
    videoUrl: pkg.videoUrl,
    videoWidth: pkg.videoWidth,
    videoHeight: pkg.videoHeight,
    videoBytes: pkg.videoBytes,
    videoDurationSec: pkg.videoDurationSec,
  });
  if (!preflight.ok) {
    await prisma.assetPackage.update({
      where: { id },
      data: { rejectionReason: preflight.reason },
    });
    return NextResponse.json(
      { error: preflight.reason, preflight },
      { status: 422 }
    );
  }
  try {
    assertTransition(pkg.status, "approved");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const updated = await prisma.assetPackage.update({
    where: { id },
    data: { status: "approved" },
  });
  await writeAudit({
    userId: user!.id,
    action: "package.approve",
    entityType: "AssetPackage",
    entityId: id,
    meta: { preflightChecks: preflight.checks },
  });
  return NextResponse.json({ package: updated, preflight });
}
