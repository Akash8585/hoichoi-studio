import { NextResponse } from "next/server";
import { requireEditor } from "@/lib/auth/guards";
import { seedDemoPipeline } from "@/lib/db/seed";
import { writeAudit } from "@/lib/security/audit";

export async function POST() {
  const { error, user } = await requireEditor();
  if (error) return error;
  const result = await seedDemoPipeline();
  await writeAudit({
    userId: user!.id,
    action: "seed.demo",
    entityType: "Brief",
    entityId: result.briefId,
    meta: result,
  });
  return NextResponse.json(result);
}
