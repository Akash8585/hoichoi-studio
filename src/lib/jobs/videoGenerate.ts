/**
 * Isolated for the next-release Video Studio. The image-first MVP never
 * queues or executes this job from generate, approve, publish, or cron.
 */
import { prisma } from "@/lib/db/prisma";
import { generateChannelVideo } from "@/lib/video/generate";
import type { Channel } from "@/lib/platforms/specs";
import { toJson } from "@/lib/utils";

export async function processPendingVideos(limit = 6, packageId?: string) {
  const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
  await prisma.assetPackage.updateMany({
    where: {
      videoStatus: "generating",
      videoLastAttemptAt: { lt: staleBefore },
      videoAttempts: { lt: 3 },
    },
    data: {
      videoStatus: "pending",
      videoError: "Recovered stale video generation job",
    },
  });

  const pending = await prisma.assetPackage.findMany({
    where: packageId
      ? {
          id: packageId,
          OR: [
            { videoStatus: "pending" },
            { videoStatus: "failed", videoAttempts: { lt: 3 } },
          ],
        }
      : {
          OR: [
            { videoStatus: "pending" },
            { videoStatus: "failed", videoAttempts: { lt: 3 } },
          ],
        },
    include: { brief: true },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  const job = await prisma.jobRun.create({
    data: {
      jobName: "video_generate",
      status: "running",
      meta: toJson({ count: pending.length }),
    },
  });

  let done = 0;
  const errors: string[] = [];

  for (const pkg of pending) {
    const claimed = await prisma.assetPackage.updateMany({
      where: {
        id: pkg.id,
        videoStatus: { in: ["pending", "failed"] },
        videoAttempts: { lt: 3 },
      },
      data: {
        videoStatus: "generating",
        videoAttempts: { increment: 1 },
        videoLastAttemptAt: new Date(),
        videoError: null,
      },
    });
    if (claimed.count === 0) continue;

    try {
      const result = await generateChannelVideo({
        channel: pkg.channel as Channel,
        title: pkg.brief.title,
        prompt: pkg.videoPrompt || `Cinematic motion for ${pkg.channel}`,
        imageUrl: pkg.imageUrl,
        fileStem: `${pkg.id}-video-${Date.now()}`,
      });
      await prisma.assetPackage.update({
        where: { id: pkg.id },
        data: {
          videoUrl: result.url,
          videoWidth: result.width,
          videoHeight: result.height,
          videoBytes: result.bytes,
          videoDurationSec: result.durationSec,
          videoProvider: result.provider,
          videoModel: result.model,
          videoStatus: "ready",
          videoError: null,
        },
      });
      done += 1;
    } catch (e) {
      errors.push(`${pkg.id}: ${(e as Error).message}`);
      await prisma.assetPackage.update({
        where: { id: pkg.id },
        data: {
          videoStatus: pkg.videoAttempts + 1 >= 3 ? "failed" : "pending",
          videoError: (e as Error).message.slice(0, 1000),
        },
      });
    }
  }

  await prisma.jobRun.update({
    where: { id: job.id },
    data: {
      status: errors.length && !done ? "failed" : "success",
      finishedAt: new Date(),
      error: errors.slice(0, 5).join("; ") || null,
      meta: toJson({ done, errors }),
    },
  });

  return { done, errors, total: pending.length };
}
