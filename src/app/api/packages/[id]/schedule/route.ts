import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { scheduleSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/security/audit";
import { publishDuePosts } from "@/lib/jobs/publishDue";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const parsed = scheduleSchema.safeParse(
    body.scheduledAt ? body : { scheduledAt: new Date().toISOString() }
  );
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const pkg = await prisma.assetPackage.findUnique({ where: { id } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (pkg.status !== "approved") {
    return NextResponse.json(
      { error: "Only approved packages can be scheduled" },
      { status: 400 }
    );
  }

  const scheduledAt = new Date(parsed.data.scheduledAt);
  const idempotencyKey = `${pkg.id}-${scheduledAt.toISOString()}`;

  const post = await prisma.post.upsert({
    where: { idempotencyKey },
    create: {
      packageId: pkg.id,
      channel: pkg.channel,
      status: "scheduled",
      scheduledAt,
      idempotencyKey,
    },
    update: {
      status: "scheduled",
      scheduledAt,
    },
  });

  await writeAudit({
    userId: user!.id,
    action: "package.schedule",
    entityType: "Post",
    entityId: post.id,
    meta: { scheduledAt },
  });

  if (scheduledAt.getTime() <= Date.now() + 2000) {
    await publishDuePosts(5);
  }

  return NextResponse.json({ post });
}
