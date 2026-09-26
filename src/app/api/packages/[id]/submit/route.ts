import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { assertTransition, imageAssetsReady } from "@/lib/domain/status";
import { writeAudit } from "@/lib/security/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const pkg = await prisma.assetPackage.findUnique({ where: { id } });
  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!imageAssetsReady(pkg)) {
    return NextResponse.json(
      { error: "A compliant image and passing quality checks are required before review" },
      { status: 400 }
    );
  }
  try {
    assertTransition(pkg.status, "pending_approval");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  const updated = await prisma.assetPackage.update({
    where: { id },
    data: { status: "pending_approval" },
  });
  await writeAudit({
    userId: user!.id,
    action: "package.submit",
    entityType: "AssetPackage",
    entityId: id,
  });
  return NextResponse.json({ package: updated });
}
