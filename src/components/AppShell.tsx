"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { useEffect, useState, type ComponentType } from "react";
import {
  BarChart3,
  CheckSquare2,
  Clapperboard,
  ImageIcon,
  LayoutGrid,
  LogOut,
  PanelLeft,
  Plus,
  Radio,
  Unplug,
} from "lucide-react";

const createLinks = [
  { href: "/studio", label: "Images", icon: ImageIcon },
  { href: "/studio/videos", label: "Videos", icon: Clapperboard },
];

const workspaceLinks = [
  { href: "/approvals", label: "Review", icon: CheckSquare2 },
  { href: "/publisher", label: "Publish", icon: Radio },
  { href: "/insights", label: "Performance", icon: BarChart3 },
  { href: "/integrations", label: "Integrations", icon: Unplug },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/studio") return pathname === "/studio";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data } = useSession();
  const [pending, setPending] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const createOpen = pathname.startsWith("/studio");

  useEffect(() => {
    setCollapsed(window.localStorage.getItem("sidebar-collapsed") === "1");
  }, []);

  useEffect(() => {
    fetch("/api/approvals")
      .then((response) => response.json())
      .then((payload) => setPending(payload.packages?.length || 0))
      .catch(() => undefined);
  }, [pathname]);

  useEffect(() => {
    function flushDue() {
      fetch("/api/publisher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "publish_due" }),
      }).catch(() => undefined);
    }
    flushDue();
    const timer = window.setInterval(flushDue, 20_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleSidebar() {
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#090909]">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-[#1a1a1a] bg-[#090909] transition-[width] duration-200 md:flex md:flex-col",
          collapsed ? "w-[72px] px-2 py-4" : "w-60 p-4"
        )}
      >
        <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between gap-2 px-1")}>
          {!collapsed && (
            <Link href="/" className="flex min-w-0 items-center gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-white text-black">
                <Clapperboard className="size-4" />
              </span>
              <p className="truncate text-sm font-medium tracking-tight">hoichoi</p>
            </Link>
          )}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Open sidebar" : "Close sidebar"}
            className="grid size-9 shrink-0 place-items-center rounded-[10px] text-zinc-400 hover:bg-white/5 hover:text-white"
          >
            <PanelLeft className="size-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary navigation">
          <NavItem
            href="/"
            label="Campaigns"
            icon={LayoutGrid}
            active={pathname === "/"}
            collapsed={collapsed}
          />

          <div className="my-2 h-px bg-[#1a1a1a]" />
          {!collapsed && (
            <p className="px-3 pb-1 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Create</p>
          )}
          {createLinks.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={isActive(pathname, link.href)}
              collapsed={collapsed}
            />
          ))}

          <div className="my-2 h-px bg-[#1a1a1a]" />
          {workspaceLinks.map((link) => (
            <NavItem
              key={link.href}
              href={link.href}
              label={link.label}
              icon={link.icon}
              active={isActive(pathname, link.href)}
              collapsed={collapsed}
              badge={link.href === "/approvals" && pending > 0 ? pending : undefined}
            />
          ))}
        </nav>

        <div className={cn("mt-4", collapsed ? "flex justify-center" : "rounded-[15px] bg-[#141414] p-3")}>
          {!collapsed && <p className="truncate text-xs text-zinc-400">{data?.user?.email}</p>}
          <button
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    window.location.href = "/login";
                  },
                },
              })
            }
            title="Sign out"
            aria-label="Sign out"
            className={cn(
              "flex items-center text-xs text-zinc-400 hover:bg-white/5 hover:text-white",
              collapsed
                ? "size-11 justify-center rounded-[10px]"
                : "mt-3 min-h-10 w-full gap-2 rounded-full px-3"
            )}
          >
            <LogOut className="size-4 shrink-0" />
            {!collapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <main
        className={cn(
          "min-h-screen px-4 pb-28 pt-6 transition-[margin] duration-200 md:px-8 md:pb-12 md:pt-8",
          collapsed ? "md:ml-[72px]" : "md:ml-60"
        )}
      >
        <div className="mx-auto max-w-[1400px]">{children}</div>
      </main>

      <nav
        className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-[20px] border border-white/10 bg-black/85 p-1.5 backdrop-blur-xl md:hidden"
        aria-label="Mobile navigation"
      >
        {[
          { href: "/", label: "Campaigns", icon: LayoutGrid },
          { href: "/studio", label: "Create", icon: Plus },
          { href: "/approvals", label: "Review", icon: CheckSquare2 },
          { href: "/publisher", label: "Publish", icon: Radio },
          { href: "/insights", label: "Performance", icon: BarChart3 },
        ].map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : link.href === "/studio"
                ? createOpen
                : isActive(pathname, link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-12 flex-col items-center justify-center gap-1 rounded-[15px] text-[10px] text-zinc-600",
                active && "bg-white text-black"
              )}
            >
              <Icon className="size-4" />
              {link.label}
              {link.href === "/approvals" && pending > 0 && (
                <span className="absolute right-2 top-1 size-2 rounded-full bg-[#ff7a3d]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
  collapsed,
  badge,
}: {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  active: boolean;
  collapsed: boolean;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex min-h-11 items-center rounded-[10px] text-sm text-zinc-500 transition hover:bg-white/5 hover:text-white",
        collapsed ? "justify-center" : "gap-3 px-3",
        active && "bg-[#1c1c1c] text-white"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge ? (
        collapsed ? (
          <span className="absolute right-2 top-2 size-2 rounded-full bg-white" />
        ) : (
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-black">
            {badge}
          </span>
        )
      ) : null}
    </Link>
  );
}
