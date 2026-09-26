import { NextResponse } from "next/server";
import { requireEditor, requireSession } from "@/lib/auth/guards";
import { notFound, ownedPackage } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";
import { patchPackageSchema } from "@/lib/validation/schemas";
import { toJson } from "@/lib/utils";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const pkg = await ownedPackage(user!.id, id);
  if (!pkg) return notFound();
  return NextResponse.json({
    package: pkg,
    assets: {
      imageStatus: pkg.imageStatus,
      videoStatus: pkg.videoStatus,
      imageUrl: pkg.imageUrl,
      videoUrl: pkg.videoUrl,
    },
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json();
  const parsed = patchPackageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const pkg = await ownedPackage(user!.id, id);
  if (!pkg) return notFound();
  if (!["draft", "pending_approval"].includes(pkg.status)) {
    return NextResponse.json(
      { error: "Can only edit draft/pending packages" },
      { status: 400 }
    );
  }
  const updated = await prisma.assetPackage.update({
    where: { id },
    data: {
      copyBn: parsed.data.copyBn ?? pkg.copyBn,
      copyEn: parsed.data.copyEn ?? pkg.copyEn,
      title: parsed.data.title ?? pkg.title,
      cta: parsed.data.cta ?? pkg.cta,
      hashtags: parsed.data.hashtags
        ? toJson(parsed.data.hashtags)
        : pkg.hashtags,
      reviewNotes: parsed.data.reviewNotes ?? pkg.reviewNotes,
    },
  });
  return NextResponse.json({ package: updated });
}
