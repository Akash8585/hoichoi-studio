import { NextResponse } from "next/server";
import { requireEditor, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { generateWeeklyReport } from "@/lib/insights/report";
import { weeklyReportSchema } from "@/lib/validation/schemas";
import { rateLimit } from "@/lib/security/rateLimit";
import { parseJsonArray } from "@/lib/utils";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  const reports = await prisma.weeklyReport.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json({
    reports: reports.map((r) => ({
      ...r,
      citedPostIds: parseJsonArray(r.citedPostIds),
      claims: JSON.parse(r.claimsJson || "[]"),
    })),
  });
}

export async function POST(req: Request) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const rl = await rateLimit(`weekly:${user!.id}`, 10, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = weeklyReportSchema.safeParse(
    body.periodStart
      ? body
      : {
          periodStart: new Date(Date.now() - 7 * 86400000).toISOString(),
          periodEnd: new Date().toISOString(),
        }
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const report = await generateWeeklyReport({
    periodStart: new Date(parsed.data.periodStart),
    periodEnd: new Date(parsed.data.periodEnd),
    createdById: user!.id,
  });
  return NextResponse.json({ report });
}
