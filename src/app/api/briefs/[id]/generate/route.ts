import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/security/rateLimit";
import { writeAudit } from "@/lib/security/audit";
import { runBriefGeneration } from "@/lib/studio/generate";

export const maxDuration = 300;

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const rl = await rateLimit(`generate:${user!.id}`, 20, 60 * 60 * 1000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const brief = await runBriefGeneration(id);
    const warnings = (brief?.packages || []).flatMap((pkg) => {
      const items: Array<{ packageId: string; type: string; message: string }> = [];
      if (pkg.textProvider === "deterministic-fallback") {
        items.push({
          packageId: pkg.id,
          type: "text_fallback",
          message: "We used backup copy. Please read it before sending to review.",
        });
      }
      if (pkg.imageStatus === "placeholder") {
        items.push({
          packageId: pkg.id,
          type: "image_placeholder",
          message: "The image did not generate correctly. Try again before sending to review.",
        });
      }
      return items;
    });
    await writeAudit({
      userId: user!.id,
      action: "brief.generate",
      entityType: "Brief",
      entityId: id,
    });
    return NextResponse.json({ brief, warnings });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
