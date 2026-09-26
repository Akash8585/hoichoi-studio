import { NextResponse } from "next/server";
import { requireCron, requireEditor } from "@/lib/auth/guards";
import { generateWeeklyReport } from "@/lib/insights/report";
import { weeklyReportSchema } from "@/lib/validation/schemas";

export async function POST(req: Request) {
  const isCron = req.headers.get("authorization")?.startsWith("Bearer ");
  let createdById: string | undefined;
  if (isCron) {
    const denied = requireCron(req);
    if (denied) return denied;
  } else {
    const { error, user } = await requireEditor();
    if (error) return error;
    createdById = user!.id;
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
    createdById,
  });
  return NextResponse.json({ report });
}

export async function GET(req: Request) {
  return POST(req);
}
