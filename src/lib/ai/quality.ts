import type { GeneratedChannelPack } from "@/lib/ai/prompts";

/** Gates that block submit and appear in the quality panel. */
export const HUMAN_QUALITY_KEYS = [
  "xWithinLimit",
  "youtubeTitleWithinLimit",
  "requiredTermsPresent",
  "forbiddenTermsAbsent",
] as const;

export type HumanQualityKey = (typeof HUMAN_QUALITY_KEYS)[number];

/** Server-side heuristics only — never flip user-facing passed / submit. */
export const INTERNAL_QUALITY_KEYS = [
  "hasThreeChannels",
  "nativeBengali",
  "uniqueCtas",
  "uniqueVisualDirections",
  "lowCopySimilarity",
  "briefAdherence",
] as const;

function words(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

function jaccard(a: string, b: string) {
  const left = words(a);
  const right = words(b);
  const intersection = [...left].filter((word) => right.has(word)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

export function bengaliScriptRatio(value: string) {
  const letters = [...value].filter((char) => /\p{L}/u.test(char));
  if (!letters.length) return 0;
  const bengali = letters.filter((char) => /[\u0980-\u09FF]/u.test(char));
  return bengali.length / letters.length;
}

/**
 * Submit / UI readiness. Ignores internal distinctness heuristics so older
 * stored JSON with `passed: false` solely from lowCopySimilarity still unlocks.
 */
export function humanQualityPassed(quality: Record<string, unknown>): boolean {
  if (quality.requiresHumanReview === true) {
    return false;
  }
  if (HUMAN_QUALITY_KEYS.some((key) => quality[key] === false)) {
    return false;
  }
  if (HUMAN_QUALITY_KEYS.some((key) => key in quality)) {
    return true;
  }
  // Legacy blobs without per-gate keys: unlock when only internal flags failed.
  if (
    quality.passed === false &&
    INTERNAL_QUALITY_KEYS.some((key) => quality[key] === false)
  ) {
    return true;
  }
  return quality.passed === true;
}

/** Rewrite `passed` from human gates only (safe for already-stored rows). */
export function reconcileQualityChecks(
  quality: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...quality,
    passed: humanQualityPassed(quality),
  };
}

export function evaluateGenerationQuality(
  packs: GeneratedChannelPack[],
  context?: { briefBody?: string; mustInclude?: string[]; mustAvoid?: string[] }
) {
  const combined = packs
    .flatMap((pack) => [
      pack.copyBn,
      pack.copyEn,
      pack.imagePrompt,
      pack.videoPrompt,
    ])
    .join(" ")
    .toLowerCase();
  const generatedCopy = packs
    .flatMap((pack) => [pack.copyBn, pack.copyEn])
    .join(" ")
    .toLowerCase();
  const requiredTerms = context?.mustInclude || [];
  const forbiddenTerms = context?.mustAvoid || [];
  const briefKeywords = (context?.briefBody || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 6)
    .slice(0, 8);
  const checks = {
    hasThreeChannels: new Set(packs.map((pack) => pack.channel)).size === 3,
    nativeBengali: packs.every((pack) => bengaliScriptRatio(pack.copyBn) >= 0.58),
    xWithinLimit: packs
      .filter((pack) => pack.channel === "x")
      .every((pack) => pack.copyBn.length <= 260 && pack.copyEn.length <= 260),
    youtubeTitleWithinLimit: packs
      .filter((pack) => pack.channel === "youtube_shorts")
      .every((pack) => (pack.title || "").length <= 90),
    uniqueCtas: new Set(packs.map((pack) => pack.cta.toLowerCase())).size === 3,
    uniqueVisualDirections:
      new Set(packs.map((pack) => pack.imagePrompt.toLowerCase())).size === 3,
    lowCopySimilarity: true,
    requiredTermsPresent: requiredTerms.every((term) =>
      combined.includes(term.toLowerCase())
    ),
    forbiddenTermsAbsent: forbiddenTerms.every(
      (term) => !generatedCopy.includes(term.toLowerCase())
    ),
    briefAdherence:
      briefKeywords.length === 0 ||
      briefKeywords.some((keyword) => combined.includes(keyword)),
  };

  for (let i = 0; i < packs.length; i += 1) {
    for (let j = i + 1; j < packs.length; j += 1) {
      if (
        jaccard(packs[i].copyBn, packs[j].copyBn) > 0.72 ||
        jaccard(packs[i].copyEn, packs[j].copyEn) > 0.72
      ) {
        checks.lowCopySimilarity = false;
      }
    }
  }

  const humanPassed = HUMAN_QUALITY_KEYS.every((key) => checks[key]);
  const internalPassed = INTERNAL_QUALITY_KEYS.every((key) => checks[key]);

  return {
    ...checks,
    /** True when human-actionable gates pass. Internal heuristics do not flip this. */
    passed: humanPassed,
    /** Server-side repair trigger; includes distinctness heuristics. */
    needsRepair: !humanPassed || !internalPassed,
    strategy: "independent-source-brief-generation",
  };
}
