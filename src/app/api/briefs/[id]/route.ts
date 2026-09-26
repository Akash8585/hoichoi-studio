import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { notFound } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";

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
