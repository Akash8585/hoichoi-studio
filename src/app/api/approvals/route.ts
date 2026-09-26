import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { packagesFor } from "@/lib/auth/ownership";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const { error, user } = await requireSession();
  if (error) return error;
  const packages = await prisma.assetPackage.findMany({
    where: { status: "pending_approval", ...packagesFor(user!.id) },
    include: { brief: true },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ packages });
}
