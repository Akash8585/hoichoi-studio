import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { ensureDemoUser } from "@/lib/db/seed";
import { getSession } from "@/lib/auth/guards";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  try {
    await ensureDemoUser();
  } catch {
    // DB may not be ready on first boot
  }
  const session = await getSession();
  if (!session) redirect("/login");
  return <AppShell>{children}</AppShell>;
}
