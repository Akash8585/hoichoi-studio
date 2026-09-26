import { NextResponse } from "next/server";
import { requireEditor, requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { createBriefSchema } from "@/lib/validation/schemas";
import { writeAudit } from "@/lib/security/audit";
import { toJson } from "@/lib/utils";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  const briefs = await prisma.brief.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      packages: {
        include: {
          posts: {
            select: {
              status: true,
              metrics: { select: { id: true }, take: 1 },
            },
          },
        },
      },
    },
  });
  return NextResponse.json({ briefs });
}

export async function POST(req: Request) {
  const { error, user } = await requireEditor();
  if (error) return error;
  const body = await req.json();
  const parsed = createBriefSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const brief = await prisma.brief.create({
    data: {
      title: parsed.data.title,
      body: parsed.data.body,
      language: parsed.data.language,
      brandVoice: parsed.data.brandVoice,
      objective: parsed.data.objective,
      audience: parsed.data.audience,
      mustInclude: toJson(parsed.data.mustInclude),
      mustAvoid: toJson(parsed.data.mustAvoid),
      reviewLanguagePriority: parsed.data.reviewLanguagePriority,
      sourceReportId: parsed.data.sourceReportId,
      createdById: user!.id,
    },
  });
  await writeAudit({
    userId: user!.id,
    action: "brief.create",
    entityType: "Brief",
    entityId: brief.id,
  });
  return NextResponse.json({ brief }, { status: 201 });
}
