import { NextResponse } from "next/server";
import { requireCron } from "@/lib/auth/guards";
import {
  cleanupDiscardedMedia,
  quarantineLegacyPlaceholderMedia,
} from "@/lib/jobs/mediaLifecycle";

async function run(req: Request) {
  const denied = requireCron(req);
  if (denied) return denied;
  const [cleanup, legacy] = await Promise.all([
    cleanupDiscardedMedia(),
    quarantineLegacyPlaceholderMedia(),
  ]);
  const result = { cleanup, legacy };
  return NextResponse.json({ ok: true, result });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
