import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/security/rateLimit";
import { notFound, ownedPackage } from "@/lib/auth/ownership";
import { regeneratePackage } from "@/lib/studio/generate";
import { writeAudit } from "@/lib/security/audit";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const owned = await ownedPackage(user!.id, id);
  if (!owned) return notFound();
  const rl = await rateLimit(`regen:${user!.id}`, 30, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const result = await regeneratePackage(id);
    await writeAudit({
      userId: user!.id,
      action: "package.regenerate",
      entityType: "AssetPackage",
      entityId: id,
    });
    return NextResponse.json({
      package: result.package,
      siblings: result.siblings,
    });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
