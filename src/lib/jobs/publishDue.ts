import { prisma } from "@/lib/db/prisma";
import { publishToMockAdapter } from "@/lib/platforms/adapters";
import type { Channel } from "@/lib/platforms/specs";
import { seedMetrics } from "@/lib/insights/metrics";
import { parseJsonArray, toJson } from "@/lib/utils";

export async function publishDuePosts(limit = 20) {
  const due = await prisma.post.findMany({
    where: {
      status: { in: ["scheduled", "publishing"] },
      scheduledAt: { lte: new Date() },
    },
    include: { package: true },
    take: limit,
    orderBy: { scheduledAt: "asc" },
  });

  const job = await prisma.jobRun.create({
    data: { jobName: "publish_due", status: "running", meta: toJson({ count: due.length }) },
  });

  let published = 0;
  let rejected = 0;

  for (const post of due) {
    await prisma.post.update({
      where: { id: post.id },
      data: { status: "publishing" },
    });

    const pkg = post.package;
    const result = await publishToMockAdapter({
      channel: post.channel as Channel,
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

    if (!result.ok) {
      rejected += 1;
      await prisma.post.update({
        where: { id: post.id },
        data: {
          status: "rejected",
          adapterResponse: toJson(result),
        },
      });
      await prisma.assetPackage.update({
        where: { id: pkg.id },
        data: { rejectionReason: result.reason },
      });
      continue;
    }

    published += 1;
    await prisma.post.update({
      where: { id: post.id },
      data: {
        status: "published",
        publishedAt: new Date(),
        externalMockId: result.externalMockId,
        adapterResponse: toJson(result),
      },
    });

    const metrics = seedMetrics(post.id, 0);
    await prisma.metricSnapshot.create({
      data: { postId: post.id, ...metrics },
    });
  }

  await prisma.jobRun.update({
    where: { id: job.id },
    data: {
      status: "success",
      finishedAt: new Date(),
      meta: toJson({ published, rejected }),
    },
  });

  return { published, rejected, total: due.length };
}
