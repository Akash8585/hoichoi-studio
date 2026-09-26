import { NextResponse } from "next/server";
import { requireEditor, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { publishDuePosts } from "@/lib/jobs/publishDue";
import { refreshMetrics } from "@/lib/jobs/metricsRefresh";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  await publishDuePosts().catch(() => undefined);
  const posts = await prisma.post.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      package: true,
      metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json({ posts });
}

export async function POST(req: Request) {
  const { error } = await requireEditor();
  if (error) return error;
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  if (action === "publish_due") {
    return NextResponse.json({ result: await publishDuePosts() });
  }
  if (action === "metrics_refresh") {
    return NextResponse.json({ result: await refreshMetrics() });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
