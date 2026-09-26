import { prisma } from "@/lib/db/prisma";
import { seedMetrics } from "@/lib/insights/metrics";
import { toJson } from "@/lib/utils";

export async function refreshMetrics() {
  const posts = await prisma.post.findMany({
    where: { status: "published" },
    include: { metrics: { orderBy: { collectedAt: "desc" } } },
  });

  const job = await prisma.jobRun.create({
    data: {
      jobName: "metrics_refresh",
      status: "running",
      meta: toJson({ count: posts.length }),
    },
  });

  let created = 0;
  for (const post of posts) {
    const tick = post.metrics.length;
    const metrics = seedMetrics(post.id, tick + 1);
    await prisma.metricSnapshot.create({
      data: { postId: post.id, ...metrics },
    });
    created += 1;
  }

  await prisma.jobRun.update({
    where: { id: job.id },
    data: {
      status: "success",
      finishedAt: new Date(),
      meta: toJson({ created }),
    },
  });

  return { created };
}
