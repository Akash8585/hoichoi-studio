import { prisma } from "@/lib/db/prisma";
import { GENERATION_LOCK_MS } from "@/lib/storage/limits";

function lockActive(at?: Date | null) {
  if (!at) return false;
  return Date.now() - at.getTime() < GENERATION_LOCK_MS;
}

export async function acquireBriefGenerationLock(briefId: string) {
  const brief = await prisma.brief.findUnique({ where: { id: briefId } });
  if (!brief) throw new Error("Brief not found");
  if (lockActive(brief.generatingAt)) {
    throw new Error("Generation already in progress for this brief");
  }
  await prisma.brief.update({
    where: { id: briefId },
    data: { generatingAt: new Date() },
  });
}

export async function releaseBriefGenerationLock(briefId: string) {
  await prisma.brief
    .update({
      where: { id: briefId },
      data: { generatingAt: null },
    })
    .catch(() => undefined);
}

export async function acquirePackageGenerationLock(packageId: string) {
  const pkg = await prisma.assetPackage.findUnique({ where: { id: packageId } });
  if (!pkg) throw new Error("Package not found");
  if (lockActive(pkg.generatingAt)) {
    throw new Error("Regeneration already in progress for this package");
  }
  await prisma.assetPackage.update({
    where: { id: packageId },
    data: { generatingAt: new Date() },
  });
}

export async function releasePackageGenerationLock(packageId: string) {
  await prisma.assetPackage
    .update({
      where: { id: packageId },
      data: { generatingAt: null },
    })
    .catch(() => undefined);
}
