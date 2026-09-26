"use client";

import { useState, type ReactNode } from "react";
import { motion } from "motion/react";
import { Clapperboard, LoaderCircle, MessageCircle, Play } from "lucide-react";
import { bengaliScriptRatio } from "@/lib/ai/quality";
import { PLATFORM_SPECS, type Channel } from "@/lib/platforms/specs";
import { StatusBadge } from "@/components/ui/core";
import { cn } from "@/lib/utils";

const icon = {
  instagram_reels: Clapperboard,
  youtube_shorts: Play,
  x: MessageCircle,
};

export type PreviewPackage = {
  id: string;
  channel: string;
  status: string;
  imageUrl?: string | null;
  videoUrl?: string | null;
  imageStatus: string;
  videoStatus: string;
  imageProvider?: string | null;
  videoProvider?: string | null;
  copyBn?: string | null;
  copyEn?: string | null;
  title?: string | null;
  cta?: string | null;
  hashtags?: string;
};

/** Show the single title only when its script matches the selected language. */
function titleVisibleForLanguage(title: string | null | undefined, language: "bn" | "en") {
  const trimmed = title?.trim();
  if (!trimmed) return false;
  const letters = [...trimmed].filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return true;
  const ratio = bengaliScriptRatio(trimmed);
  return language === "bn" ? ratio >= 0.4 : ratio < 0.4;
}

export function PlatformPreview({
  pkg,
  footer,
  imageLoading = false,
}: {
  pkg: PreviewPackage;
  footer?: ReactNode;
  imageLoading?: boolean;
}) {
  const channel = pkg.channel as Channel;
  const spec = PLATFORM_SPECS[channel];
  const Icon = icon[channel];
  const [copyLanguage, setCopyLanguage] = useState<"bn" | "en">("bn");
  const placeholder = pkg.imageStatus === "placeholder" || pkg.imageProvider === "svg_fallback";
  const visibleTitle = titleVisibleForLanguage(pkg.title, copyLanguage) ? pkg.title : null;
  const visibleCopy = copyLanguage === "bn" ? pkg.copyBn : pkg.copyEn;
  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="surface-card overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-[#262626] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-full bg-white/6">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-medium">{spec.label}</p>
            <p className="text-[11px] text-zinc-500">{spec.aspect}</p>
          </div>
        </div>
        <StatusBadge status={pkg.status} />
      </div>

      <div className="grid gap-0 xl:grid-cols-[minmax(220px,0.8fr)_1.2fr]">
        <div className="relative flex min-h-[340px] items-center justify-center bg-black p-4">
          <div
            className={cn(
              "relative max-h-[520px] w-full overflow-hidden rounded-[15px] bg-[#141414]",
              channel === "x" ? "aspect-square max-w-[420px]" : "aspect-[9/16] max-w-[290px]"
            )}
          >
            {pkg.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={pkg.imageUrl}
                alt={`${spec.label} generated visual`}
                className={cn("size-full object-cover", imageLoading && "opacity-40")}
              />
            ) : (
              <div className="grid size-full place-items-center text-center text-sm text-zinc-500">
                No visual generated
              </div>
            )}
            {imageLoading && (
              <div className="absolute inset-0 grid place-items-center bg-black/45" aria-busy="true">
                <LoaderCircle className="size-8 animate-spin text-white" aria-label="Regenerating image" />
              </div>
            )}
            {placeholder && !imageLoading && (
              <div className="absolute inset-0 grid place-items-center bg-black/75 p-6 text-center">
                <div>
                  <p className="font-medium text-red-300">Image didn’t generate</p>
                  <p className="mt-1 text-xs text-zinc-400">Try regenerate before sending this to review.</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-col p-5">
          <div className="mb-4 flex w-fit rounded-full bg-[#090909] p-1">
            {(["bn", "en"] as const).map((language) => (
              <button
                key={language}
                onClick={() => setCopyLanguage(language)}
                className={cn(
                  "min-h-9 rounded-full px-3 text-xs font-medium",
                  copyLanguage === language ? "bg-[#1c1c1c] text-white" : "text-zinc-500"
                )}
              >
                {language === "bn" ? "বাংলা" : "English"}
              </button>
            ))}
          </div>
          {visibleTitle && <p className="mb-3 text-sm font-medium">{visibleTitle}</p>}
          <p className={cn("whitespace-pre-wrap text-[15px] leading-relaxed text-zinc-200", copyLanguage === "bn" && "font-bengali")}>
            {visibleCopy}
          </p>
          {footer && (
            <div className="mt-auto border-t border-[#262626] pt-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}
