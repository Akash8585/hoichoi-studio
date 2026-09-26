import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { notFound, ownedPackage } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";
import { assertTransition } from "@/lib/domain/status";
import { writeAudit } from "@/lib/security/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const pkg = await ownedPackage(user!.id, id);
  if (!pkg) return notFound();
  try {
    assertTransition(pkg.status, "discarded");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const updated = await prisma.assetPackage.update({
    where: { id },
    data: { status: "discarded" },
  });
  await writeAudit({
    userId: user!.id,
    action: "package.discard",
    entityType: "AssetPackage",
    entityId: id,
  });
  return NextResponse.json({ package: updated });
}
