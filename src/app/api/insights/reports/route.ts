import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { postsFor, reportsFor } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";
import { channelLabel } from "@/lib/insights/display";
import { parseJsonArray } from "@/lib/utils";

export async function GET() {
  const { error, user } = await requireSession();
  if (error) return error;
  const reports = await prisma.weeklyReport.findMany({
    where: reportsFor(user!.id),
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  const citedIds = [
    ...new Set(reports.flatMap((report) => parseJsonArray(report.citedPostIds))),
  ];
  const posts = citedIds.length
    ? await prisma.post.findMany({
        where: { id: { in: citedIds }, ...postsFor(user!.id) },
        select: { id: true, channel: true },
      })
    : [];
  const postLabels = Object.fromEntries(
    posts.map((post) => [post.id, channelLabel(post.channel)])
  );
  return NextResponse.json({
    reports: reports.map((report) => ({
      ...report,
      citedPostIds: parseJsonArray(report.citedPostIds),
      claims: JSON.parse(report.claimsJson || "[]"),
      postLabels,
    })),
  });
}
