import { prisma } from "@/lib/db/prisma";
import { toJson } from "@/lib/utils";

export async function writeAudit(input: {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  ip?: string | null;
  meta?: unknown;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ip: input.ip ?? null,
        meta: input.meta ? toJson(input.meta) : null,
      },
    });
  } catch {
    // never fail the request due to audit
  }
}
