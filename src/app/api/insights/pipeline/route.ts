import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { notFound, packagesFor } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";

/**
 * Counts packages and posts for the content pipeline sankey.
 * Query: briefId (optional). Counts only the signed in user's campaigns.
 */
export async function GET(req: Request) {
  const { error, user } = await requireSession();
  if (error) return error;

  const briefId = new URL(req.url).searchParams.get("briefId") || undefined;

  if (briefId) {
    const brief = await prisma.brief.findFirst({
      where: { id: briefId, createdById: user!.id },
      include: {
        packages: { include: { posts: { include: { metrics: { take: 1 } } } } },
      },
    });
    if (!brief) return notFound();
    const counts = stageCounts(1, brief.packages);
    return NextResponse.json({
      scope: "campaign",
      briefTitle: brief.title,
      stages: counts.stages,
      mix: counts.mix,
    });
  }

  const [briefCount, packages] = await Promise.all([
    prisma.brief.count({ where: { createdById: user!.id } }),
    prisma.assetPackage.findMany({
      where: packagesFor(user!.id),
      include: { posts: { include: { metrics: { take: 1 } } } },
    }),
  ]);

  const counts = stageCounts(briefCount, packages);
  return NextResponse.json({
    scope: "workspace",
    briefTitle: null,
    stages: counts.stages,
    mix: counts.mix,
  });
}

function stageCounts(
  briefCount: number,
  packages: Array<{
    status: string;
    posts: Array<{ status: string; metrics: unknown[] }>;
  }>
) {
  const posts = packages.flatMap((pkg) => pkg.posts);
  const generated = packages.length;
  const inReview = packages.filter((pkg) =>
    ["pending_approval", "approved", "discarded"].includes(pkg.status)
  ).length;
  const approved = packages.filter((pkg) => pkg.status === "approved").length;
  const discarded = packages.filter((pkg) => pkg.status === "discarded").length;
  const pendingApproval = packages.filter(
    (pkg) => pkg.status === "pending_approval"
  ).length;
  const scheduled = posts.filter((post) =>
    ["scheduled", "publishing", "published", "rejected"].includes(post.status)
  ).length;
  const scheduledOnly = posts.filter((post) => post.status === "scheduled").length;
  const published = posts.filter((post) => post.status === "published").length;
  const rejected = posts.filter((post) => post.status === "rejected").length;
  const insights = posts.filter(
    (post) => post.status === "published" && (post.metrics?.length || 0) > 0
  ).length;

  return {
    stages: {
      brief: briefCount,
      generated,
      review: inReview,
      approved,
      discarded,
      scheduled,
      published,
      rejected,
      insights,
    },
    /** Package and post status counts for the approval mix donut. Zeroes are hidden client side. */
    mix: {
      approved,
      inReview: pendingApproval,
      discarded,
      scheduled: scheduledOnly,
      published,
      rejected,
    },
  };
}
