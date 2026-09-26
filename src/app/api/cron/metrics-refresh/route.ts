import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth/guards";
import { refreshMetrics } from "@/lib/jobs/metricsRefresh";

async function run(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  const result = await refreshMetrics();
  return NextResponse.json({ ok: true, result });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
