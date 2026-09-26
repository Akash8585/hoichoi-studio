import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { buildComparison } from "@/lib/insights/report";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const comparison = await buildComparison(id);
  if (!comparison) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ comparison });
}
