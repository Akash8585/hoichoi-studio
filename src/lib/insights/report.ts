import { prisma } from "@/lib/db/prisma";
import { parseJsonArray, toJson } from "@/lib/utils";
import { generateStructured } from "@/lib/ai/providers";
import { z } from "zod";

export type ReportClaim = {
  claim: string;
  evidencePostIds: string[];
  recommendation?: string;
};

const reportSchema = z.object({
  claims: z.array(
    z.object({
      claim: z.string().min(5),
      evidencePostIds: z.array(z.string()).min(1),
      recommendation: z.string().optional(),
    })
  ).min(1),
});

const reportJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["claims"],
  properties: {
    claims: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["claim", "evidencePostIds"],
        properties: {
          claim: { type: "string" },
          evidencePostIds: {
            type: "array",
            minItems: 1,
            items: { type: "string" },
          },
          recommendation: { type: "string" },
        },
      },
    },
  },
};

export function validateReportClaims(
  value: unknown,
  validPostIds: Set<string>
): ReportClaim[] {
  const parsed = reportSchema.parse(value);
  for (const claim of parsed.claims) {
    if (
      !claim.evidencePostIds.length ||
      claim.evidencePostIds.some((id) => !validPostIds.has(id))
    ) {
      throw new Error(`Claim has unknown or missing evidence: ${claim.claim}`);
    }
  }
  return parsed.claims;
}

function renderClaims(claims: ReportClaim[]) {
  return [
    "# Weekly report across platforms",
    "",
    ...claims.flatMap((claim) => [
      `${claim.claim} ${claim.evidencePostIds
        .map((id) => `[post:${id}]`)
        .join(" ")}`,
      ...(claim.recommendation
        ? [`Next brief: ${claim.recommendation} ${claim.evidencePostIds
            .map((id) => `[post:${id}]`)
            .join(" ")}`]
        : []),
    ]),
  ].join("\n");
}

export async function buildComparison(briefId: string) {
  const brief = await prisma.brief.findUnique({
    where: { id: briefId },
    include: {
      packages: {
        include: {
          posts: {
            where: { status: "published" },
            include: {
              metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!brief) return null;

  const rows = brief.packages.flatMap((pkg) =>
    pkg.posts.map((post) => {
      const m = post.metrics[0];
      const engagementRate =
        m && m.views > 0
          ? Number((((m.likes + m.comments + m.shares) / m.views) * 100).toFixed(2))
          : 0;
      return {
        postId: post.id,
        channel: post.channel,
        externalMockId: post.externalMockId,
        copyEn: pkg.copyEn,
        copyBn: pkg.copyBn,
        metrics: m
          ? {
              views: m.views,
              likes: m.likes,
              comments: m.comments,
              shares: m.shares,
              saves: m.saves,
              ctr: m.ctr,
              engagementRate,
              shareRate: Number(((m.shares / Math.max(m.views, 1)) * 100).toFixed(2)),
              saveRate: Number(((m.saves / Math.max(m.views, 1)) * 100).toFixed(2)),
              collectedAt: m.collectedAt,
            }
          : null,
      };
    })
  );

  const ranked = [...rows]
    .filter((row) => row.metrics)
    .sort(
      (a, b) =>
        (b.metrics?.engagementRate || 0) - (a.metrics?.engagementRate || 0)
    );
  return {
    brief: { id: brief.id, title: brief.title },
    rows,
    winner: ranked[0]
      ? {
          channel: ranked[0].channel,
          postId: ranked[0].postId,
          reason: `Highest normalized engagement rate (${ranked[0].metrics?.engagementRate}%)`,
        }
      : null,
  };
}

export async function generateWeeklyReport(input: {
  periodStart: Date;
  periodEnd: Date;
  createdById?: string;
}) {
  const posts = await prisma.post.findMany({
    where: {
      status: "published",
      publishedAt: {
        gte: input.periodStart,
        lte: input.periodEnd,
      },
      ...(input.createdById
        ? { package: { brief: { createdById: input.createdById } } }
        : {}),
    },
    include: {
      package: true,
      metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
    },
  });

  const summary = posts.map((p) => ({
    postId: p.id,
    channel: p.channel,
    titleHint: p.package.title || p.package.copyEn?.slice(0, 80),
    metrics: p.metrics[0] ?? null,
  }));

  if (!posts.length) throw new Error("No published posts in the selected period");
  const validPostIds = new Set(posts.map((post) => post.id));
  let claims: ReportClaim[] = [];
  let rawModel: unknown = null;

  try {
    const generated = await generateStructured({
      schemaName: "weekly_report_claims",
      schema: reportJsonSchema,
      validate: (value) => ({
        claims: validateReportClaims(value, validPostIds),
      }),
      messages: [
        {
          role: "system",
          content:
            "Write content insights backed by evidence across platforms for a marketer. Name channels as Instagram Reels, YouTube Shorts, or X. Never write database ids, cuid strings, or post: prefixes inside claim or recommendation text. Put the exact post IDs only in evidencePostIds. Do not use em dashes, en dashes, or hyphen chains as punctuation.",
        },
        {
          role: "user",
          content: `Period ${input.periodStart.toISOString()} to ${input.periodEnd.toISOString()}.\nPosts JSON:\n${JSON.stringify(summary, null, 2)}\nCompare the same campaign side by side across channels when posts share a campaign.`,
        },
      ],
      temperature: 0.35,
    });
    claims = generated.data.claims;
    rawModel = generated;
  } catch {
    claims = summary.map((s) => {
        const m = s.metrics;
        return {
          claim: `${s.channel} delivered ${m?.views ?? 0} views, ${m?.likes ?? 0} likes and ${(m?.ctr ?? 0) * 100}% CTR.`,
          evidencePostIds: [s.postId],
          recommendation:
            "Reuse the strongest hook while keeping the format that fits each channel.",
        };
      });
  }
  const citedPostIds = [...new Set(claims.flatMap((claim) => claim.evidencePostIds))];
  const bodyMd = renderClaims(claims);

  const report = await prisma.weeklyReport.create({
    data: {
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      bodyMd,
      citedPostIds: toJson(citedPostIds),
      claimsJson: toJson(claims),
      rawModel: rawModel ? toJson(rawModel) : null,
      createdById: input.createdById,
    },
  });

  return { ...report, citedPostIds: parseJsonArray(report.citedPostIds) };
}
