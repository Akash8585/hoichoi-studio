import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { notFound } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";

const CHANNEL_ORDER = ["instagram_reels", "youtube_shorts", "x"] as const;

/**
 * Historical metric snapshots for a campaign, grouped by channel.
 * Returns readings only; the client decides whether a trend chart is honest.
 */
export async function GET(req: Request) {
  const { error, user } = await requireSession();
  if (error) return error;

  const briefId = new URL(req.url).searchParams.get("briefId");
  if (!briefId) {
    return NextResponse.json({ error: "briefId is required" }, { status: 400 });
  }

  const brief = await prisma.brief.findFirst({
    where: { id: briefId, createdById: user!.id },
    include: {
      packages: {
        include: {
          posts: {
            where: { status: "published" },
            include: {
              metrics: { orderBy: { collectedAt: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!brief) return notFound();

  const series = CHANNEL_ORDER.flatMap((channel) => {
    const posts = brief.packages
      .filter((pkg) => pkg.channel === channel)
      .flatMap((pkg) => pkg.posts);
    return posts.map((post) => ({
      channel,
      readings: post.metrics.map((m) => {
        const engagementRate =
          m.views > 0
            ? Number(
                (((m.likes + m.comments + m.shares) / m.views) * 100).toFixed(2)
              )
            : 0;
        return {
          collectedAt: m.collectedAt.toISOString(),
          views: m.views,
          likes: m.likes,
          engagementRate,
        };
      }),
    }));
  }).filter((row) => row.readings.length > 0);

  const maxReadings = series.reduce(
    (max, row) => Math.max(max, row.readings.length),
    0
  );

  return NextResponse.json({
    briefId: brief.id,
    briefTitle: brief.title,
    hasTrend: maxReadings > 1,
    series,
  });
}
