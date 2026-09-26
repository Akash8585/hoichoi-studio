import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { notFound, ownedBrief } from "@/lib/auth/ownership";
import { buildComparison } from "@/lib/insights/report";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const brief = await ownedBrief(user!.id, id);
  if (!brief) return notFound();
  const comparison = await buildComparison(id);
  if (!comparison) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ comparison });
}
