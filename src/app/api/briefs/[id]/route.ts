import { NextResponse } from "next/server";
import { requireEditor, requireSession } from "@/lib/auth/guards";
import { notFound, ownedBrief } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";
import { writeAudit } from "@/lib/security/audit";
import { deleteMediaByUrl } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const brief = await prisma.brief.findFirst({
    where: { id, createdById: user!.id },
    include: {
      packages: {
        include: {
          posts: {
            include: {
              metrics: { orderBy: { collectedAt: "desc" }, take: 1 },
            },
          },
        },
      },
    },
  });
  if (!brief) return notFound();
  return NextResponse.json({ brief });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const { id } = await ctx.params;
  const brief = await ownedBrief(user!.id, id);
  if (!brief) return notFound();

  const packages = await prisma.assetPackage.findMany({
    where: { briefId: id },
    select: { imageUrl: true, videoUrl: true },
  });

  await Promise.all(
    packages.flatMap((pkg) => {
      const jobs = [deleteMediaByUrl(pkg.imageUrl), deleteMediaByUrl(pkg.videoUrl)];
      if (pkg.videoUrl?.endsWith(".mp4")) {
        jobs.push(
          deleteMediaByUrl(pkg.videoUrl.replace(/\.mp4$/, ".motion.svg"))
        );
      }
      return jobs;
    })
  );

  await prisma.brief.delete({ where: { id } });

  await writeAudit({
    userId: user!.id,
    action: "brief.delete",
    entityType: "Brief",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
