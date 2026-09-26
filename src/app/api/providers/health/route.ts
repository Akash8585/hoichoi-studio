import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/guards";
import { prisma } from "@/lib/db/prisma";
import { isObjectStorageConfigured } from "@/lib/storage";

export async function GET() {
  const { error } = await requireSession();
  if (error) return error;
  const runs = await prisma.providerRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  const latest = new Map<string, (typeof runs)[number]>();
  for (const run of runs) {
    const key = `${run.provider}:${run.capability}`;
    if (!latest.has(key)) latest.set(key, run);
  }
  return NextResponse.json({
    configured: {
      cloudflare: Boolean(
        (process.env.CLOUDFLARE_ACCOUNT_ID || process.env.R2_ACCOUNT_ID) &&
          process.env.CLOUDFLARE_API_TOKEN
      ),
      openrouter: Boolean(process.env.OPENROUTER_API_KEY),
      pollinations: Boolean(process.env.POLLINATIONS_API_KEY),
      r2: isObjectStorageConfigured(),
    },
    providers: [...latest.values()],
  });
}

