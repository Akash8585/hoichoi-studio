import { prisma } from "@/lib/db/prisma";
import { deleteMediaByUrl } from "@/lib/storage";
import { DISCARDED_MEDIA_TTL_DAYS } from "@/lib/storage/limits";
import { toJson } from "@/lib/utils";

/**
 * Deletes media for packages discarded longer than the TTL.
 * Keeps Neon rows; clears URL fields so we don't point at missing objects.
 */
export async function cleanupDiscardedMedia(limit = 40) {
  const cutoff = new Date(
    Date.now() - DISCARDED_MEDIA_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  const packages = await prisma.assetPackage.findMany({
    where: {
      status: "discarded",
      updatedAt: { lte: cutoff },
      OR: [{ imageUrl: { not: null } }, { videoUrl: { not: null } }],
    },
    take: limit,
    orderBy: { updatedAt: "asc" },
  });

  const job = await prisma.jobRun.create({
    data: {
      jobName: "media_lifecycle",
      status: "running",
      meta: toJson({ count: packages.length }),
    },
  });

  let cleaned = 0;
  const errors: string[] = [];

  for (const pkg of packages) {
    try {
      await deleteMediaByUrl(pkg.imageUrl);
      await deleteMediaByUrl(pkg.videoUrl);
      // motion preview sidecar if present
      if (pkg.videoUrl?.endsWith(".mp4")) {
        await deleteMediaByUrl(pkg.videoUrl.replace(/\.mp4$/, ".motion.svg"));
      }
      await prisma.assetPackage.update({
        where: { id: pkg.id },
        data: {
          imageUrl: null,
          videoUrl: null,
          imageStatus: "failed",
          videoStatus: "failed",
        },
      });
      cleaned += 1;
    } catch (e) {
      errors.push(`${pkg.id}: ${(e as Error).message}`);
    }
  }

  await prisma.jobRun.update({
    where: { id: job.id },
    data: {
      status: errors.length && !cleaned ? "failed" : "success",
      finishedAt: new Date(),
      error: errors.slice(0, 5).join("; ") || null,
      meta: toJson({ cleaned, errors }),
    },
  });

  return { cleaned, errors, total: packages.length };
}

/** Quarantines pre-upgrade placeholder MP4 shells so they can never be approved. */
export async function quarantineLegacyPlaceholderMedia(limit = 100) {
  const packages = await prisma.assetPackage.findMany({
    where: {
      OR: [
        { videoProvider: "motion_fallback" },
        { videoBytes: { lt: 10_000 } },
      ],
    },
    take: limit,
  });
  for (const pkg of packages) {
    await deleteMediaByUrl(pkg.videoUrl);
    await prisma.assetPackage.update({
      where: { id: pkg.id },
      data: {
        videoUrl: null,
        videoBytes: null,
        videoProvider: null,
        videoModel: null,
        videoStatus: "pending",
        videoAttempts: 0,
        videoError: "Legacy placeholder quarantined; real MP4 queued",
        status: pkg.status === "approved" ? "draft" : pkg.status,
      },
    });
  }
  return { quarantined: packages.length };
}
