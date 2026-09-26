import { prisma } from "@/lib/db/prisma";

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const current = await tx.rateLimitBucket.findUnique({ where: { key } });
    if (!current || current.resetAt <= now) {
      const resetAt = new Date(now.getTime() + windowMs);
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: 1, resetAt },
        update: { count: 1, resetAt },
      });
      return { ok: true, remaining: limit - 1, retryAt: resetAt };
    }
    if (current.count >= limit) {
      return { ok: false, remaining: 0, retryAt: current.resetAt };
    }
    const updated = await tx.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
    return {
      ok: true,
      remaining: Math.max(0, limit - updated.count),
      retryAt: updated.resetAt,
    };
  });
}
