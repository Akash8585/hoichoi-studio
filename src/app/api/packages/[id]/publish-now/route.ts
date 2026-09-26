import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { notFound, ownedPackage } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/security/audit";
import { publishDuePosts } from "@/lib/jobs/publishDue";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const pkg = await ownedPackage(user!.id, id);
  if (!pkg) return notFound();
  if (pkg.status !== "approved") {
    return NextResponse.json(
      { error: "Only approved packages can be published" },
      { status: 400 }
    );
  }

  const scheduledAt = new Date();
  const idempotencyKey = `${pkg.id}-now-${scheduledAt.toISOString()}`;
  await prisma.post.create({
    data: {
      packageId: pkg.id,
      channel: pkg.channel,
      status: "scheduled",
      scheduledAt,
      idempotencyKey,
    },
  });

  const result = await publishDuePosts(10);
  await writeAudit({
    userId: user!.id,
    action: "package.publish_now",
    entityType: "AssetPackage",
    entityId: id,
    meta: result,
  });
  return NextResponse.json({ result });
}
