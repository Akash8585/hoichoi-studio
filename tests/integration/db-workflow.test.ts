import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { toJson } from "@/lib/utils";

const ids = { brief: "", report: "" };

describe("workflow persistence", () => {
  it("does not create a publishing queue entry for an unapproved package", async () => {
    const brief = await prisma.brief.create({
      data: {
        title: `integration-${Date.now()}`,
        body: "Integration workflow test brief with sufficient detail.",
        language: "bn",
      },
    });
    ids.brief = brief.id;
    const pkg = await prisma.assetPackage.create({
      data: {
        briefId: brief.id,
        channel: "x",
        status: "pending_approval",
        imageStatus: "ready",
        imageProvider: "cloudflare-workers-ai",
        videoStatus: "deferred",
        hashtags: "[]",
      },
    });
    expect(pkg.status).toBe("pending_approval");
    expect(
      await prisma.post.count({ where: { packageId: pkg.id } })
    ).toBe(0);
  });

  it("persists citation claims and report-to-brief lineage", async () => {
    const report = await prisma.weeklyReport.create({
      data: {
        periodStart: new Date(Date.now() - 86_400_000),
        periodEnd: new Date(),
        bodyMd: "- Evidence-backed claim [post:test-post]",
        citedPostIds: toJson(["test-post"]),
        claimsJson: toJson([
          {
            claim: "Evidence-backed claim",
            evidencePostIds: ["test-post"],
            recommendation: "Reuse the winning hook",
          },
        ]),
      },
    });
    ids.report = report.id;
    const derived = await prisma.brief.create({
      data: {
        title: `derived-${Date.now()}`,
        body: "Derived from verified report claims.",
        language: "both",
        sourceReportId: report.id,
      },
    });
    const loaded = await prisma.brief.findUnique({
      where: { id: derived.id },
      include: { sourceReport: true },
    });
    expect(loaded?.sourceReportId).toBe(report.id);
    expect(JSON.parse(loaded?.sourceReport?.claimsJson || "[]")).toHaveLength(1);
    await prisma.brief.delete({ where: { id: derived.id } });
  });
});

afterAll(async () => {
  if (ids.brief) {
    await prisma.brief.delete({ where: { id: ids.brief } }).catch(() => undefined);
  }
  if (ids.report) {
    await prisma.weeklyReport
      .delete({ where: { id: ids.report } })
      .catch(() => undefined);
  }
  await prisma.$disconnect();
});

