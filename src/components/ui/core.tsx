"use client";

import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "motion/react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function Button({
  variant = "primary",
  loading,
  children,
  className,
  disabled,
  ...props
}: Omit<HTMLMotionProps<"button">, "children"> & {
  children?: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
}) {
  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200",
    secondary: "bg-[#1c1c1c] text-white hover:bg-[#262626]",
    danger: "bg-red-500/12 text-red-300 hover:bg-red-500/20",
    ghost: "bg-transparent text-zinc-300 hover:bg-white/5",
  };
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12 }}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
}

const humanStatus: Record<string, string> = {
  draft: "Draft",
  pending: "Queued",
  generating: "Generating",
  pending_approval: "Needs review",
  approved: "Approved",
  scheduled: "Scheduled",
  publishing: "Publishing",
  insights: "Insights",
  published: "Published",
  rejected: "Rejected",
  failed: "Failed",
  ready: "Ready",
  placeholder: "Placeholder",
  discarded: "Discarded",
  deferred: "Deferred",
};

export function StatusBadge({ status }: { status: string }) {
  const safe = status || "unknown";
  const tone = ["ready", "approved", "published", "success"].includes(safe)
    ? "bg-emerald-400/10 text-emerald-300"
    : ["failed", "rejected", "placeholder"].includes(safe)
      ? "bg-red-400/10 text-red-300"
      : ["pending", "pending_approval", "generating", "publishing"].includes(safe)
        ? "bg-amber-400/10 text-amber-200"
        : "bg-white/5 text-zinc-300";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tone)}>
      {humanStatus[safe] || safe.replaceAll("_", " ")}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        {eyebrow && (
          <p className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-[#0099ff]">
            {eyebrow}
          </p>
        )}
        <h1 className="display-title">{title}</h1>
        {description && (
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-[#999]">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card flex min-h-56 flex-col items-center justify-center p-8 text-center">
      <span className="mb-4 grid size-12 place-items-center rounded-full bg-white/5">
        <Inbox className="size-5 text-zinc-400" aria-hidden />
      </span>
      <h3 className="text-lg font-medium tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-zinc-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Notice({
  tone = "info",
  title,
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title: string;
  children?: ReactNode;
}) {
  const tones = {
    info: "border-blue-400/20 bg-blue-400/8 text-blue-100",
    success: "border-emerald-400/20 bg-emerald-400/8 text-emerald-100",
    warning: "border-amber-400/20 bg-amber-400/8 text-amber-100",
    danger: "border-red-400/20 bg-red-400/8 text-red-100",
  };
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? Clock3 : AlertCircle;
  return (
    <div className={cn("rounded-[15px] border p-4 text-sm", tones[tone])} role="status">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">{title}</p>
          {children && <div className="mt-1 text-current/70">{children}</div>}
        </div>
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/6", className)} />;
}

export function MetricCard({
  label,
  value,
  detail,
  accent,
}: {
  label: string;
  value: string | number;
  detail?: string;
  accent?: boolean;
}) {
  return (
    <div className={cn("surface-card p-5", accent && "gradient-spotlight-orange")}>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">{label}</p>
      <p className="mt-3 text-3xl font-medium tracking-[-0.04em]">{value}</p>
      {detail && <p className="mt-2 text-xs text-zinc-500">{detail}</p>}
    </div>
  );
}

