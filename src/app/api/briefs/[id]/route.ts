import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { error } = await requireSession();
  if (error) return error;
  const { id } = await ctx.params;
  const brief = await prisma.brief.findUnique({
    where: { id },
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
  if (!brief) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ brief });
}
