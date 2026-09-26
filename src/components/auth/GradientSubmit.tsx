"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const CONIC =
  "conic-gradient(from 0deg, #00c6ff, #0072ff, #ff007a, #ff8a00, #00c6ff)";

type GradientSubmitProps = {
  loading?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
};

export function GradientSubmit({
  loading,
  disabled,
  "aria-label": ariaLabel = "Continue",
  className,
}: GradientSubmitProps) {
  return (
    <div className={cn("group relative h-[52px] w-[52px] shrink-0", className)}>
      <span
        aria-hidden
        className="auth-conic-spin pointer-events-none absolute -inset-1 rounded-full opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-70"
        style={{ background: CONIC }}
      />
      <span
        aria-hidden
        className="auth-conic-spin pointer-events-none absolute inset-0 rounded-full"
        style={{ background: CONIC }}
      />
      <button
        type="submit"
        disabled={disabled || loading}
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-[2.5px] z-10 flex items-center justify-center rounded-full bg-black",
          "shadow-[inset_0_2px_6px_rgba(255,255,255,0.12),inset_0_-2px_8px_rgba(0,0,0,0.55)]",
          "transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
        )}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <ArrowRight className="h-5 w-5 text-white transition-transform duration-200 group-hover:translate-x-0.5" />
        )}
      </button>
    </div>
  );
}
