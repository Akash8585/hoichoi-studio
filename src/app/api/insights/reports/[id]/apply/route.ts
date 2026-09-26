import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { parseJsonArray } from "@/lib/utils";
import { writeAudit } from "@/lib/security/audit";
import { channelLabel, humanizeClaim } from "@/lib/insights/display";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const report = await prisma.weeklyReport.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cited = parseJsonArray(report.citedPostIds);
  const claims = JSON.parse(report.claimsJson || "[]") as Array<{
    claim: string;
    recommendation?: string;
  }>;
  const tactics = claims
    .map((claim) => (claim.recommendation ? humanizeClaim(claim.recommendation) : ""))
    .filter(Boolean)
    .slice(0, 5);
  const posts = cited.length
    ? await prisma.post.findMany({
        where: { id: { in: cited } },
        select: { channel: true },
      })
    : [];
  const channels = [...new Set(posts.map((post) => channelLabel(post.channel)))];
  const brief = await prisma.brief.create({
    data: {
      title: `Insight follow up ${report.periodStart.toDateString()}`,
      body: `Create the next campaign using these tactics:\n${tactics
        .map((tactic, index) => `${index + 1}. ${tactic}`)
        .join("\n")}\n\nStrongest channels: ${channels.join(", ") || "the channels that won this week"}`,
      language: "both",
      objective: "Improve the next campaign using the strongest tactics from this week.",
      audience: "Bengali OTT viewers represented by the cited campaign performance.",
      mustInclude: JSON.stringify(tactics),
      mustAvoid: JSON.stringify(["uncited claims", "literal Bengali translation"]),
      reviewLanguagePriority: "bn",
      brandVoice:
        "Use the winning tactics for each channel above. Generate Bengali and English independently; preserve native Bengali phrasing.",
      sourceReportId: report.id,
      createdById: user!.id,
    },
  });

  await writeAudit({
    userId: user!.id,
    action: "report.apply",
    entityType: "Brief",
    entityId: brief.id,
    meta: { reportId: id },
  });

  return NextResponse.json({
    brief,
    redirectTo: `/studio?brief=${brief.id}`,
    inheritedTactics: tactics,
  });
}
