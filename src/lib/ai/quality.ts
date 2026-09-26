import type { GeneratedChannelPack } from "@/lib/ai/prompts";

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

  return {
    ...checks,
    passed: Object.values(checks).every(Boolean),
    strategy: "independent-source-brief-generation",
  };
}

