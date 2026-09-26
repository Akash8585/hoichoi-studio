import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  email?: string | null;
  role: "editor" | "viewer";
};

export async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

export async function requireSession() {
  const session = await getSession();
  if (!session?.user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null as SessionUser | null,
    };
  }
  const user: SessionUser = {
    id: session.user.id,
    email: session.user.email,
    role: (session.user.role as SessionUser["role"]) ?? "viewer",
  };
  return { error: null, user };
}

export async function requireEditor() {
  const { error, user } = await requireSession();
  if (error) return { error, user: null as SessionUser | null };
  if (!user || user.role !== "editor") {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      user: null as SessionUser | null,
    };
  }
  return { error: null, user };
}

export function requireCron(req: Request) {
  const secret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Unauthorized cron" }, { status: 401 });
  }
  return null;
}
