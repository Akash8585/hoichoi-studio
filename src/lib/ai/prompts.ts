import type { Channel } from "@/lib/platforms/specs";
import { PLATFORM_SPECS } from "@/lib/platforms/specs";

export type GeneratedChannelPack = {
  channel: Channel;
  copyBn: string;
  copyEn: string;
  title?: string;
  hashtags: string[];
  cta: string;
  imagePrompt: string;
  videoPrompt: string;
  creativeDirection?: string;
  textProvider?: string;
  textModel?: string;
  generationStrategy?: string;
  qualityChecks?: Record<string, unknown>;
};

export type ChannelStrategy = {
  channel: Channel;
  tone: string;
  ctaStyle: string;
  hashtagConvention: string;
  visualComposition: string;
  videoMotion: string;
};

export function buildStrategyPrompt(input: {
  title: string;
  body: string;
  brandVoice?: string | null;
  objective?: string | null;
  audience?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
}) {
  return `Create three meaningfully different channel strategies for a Bengali OTT title.
Title: ${input.title}
Brief: ${input.body}
Brand voice: ${input.brandVoice || "premium Bengali entertainment, warm, cinematic"}
Campaign objective: ${input.objective || "drive qualified viewing intent"}
Audience: ${input.audience || "Bengali entertainment viewers"}
Must include: ${(input.mustInclude || []).join(", ") || "none"}
Must avoid: ${(input.mustAvoid || []).join(", ") || "spoilers"}

Instagram Reels: emotional discovery, 9:16, community CTA.
YouTube Shorts: lead with a hook for discovery, 9:16, title and subscribe CTA.
X: concise conversation, 1:1, at most five hashtags.

Each strategy must use a different shot scale, subject placement, camera angle, lighting,
negative space, CTA style and hashtag convention.
The visualComposition must describe a photographic film scene only. Never request a poster,
key art, thumbnail, title card, text overlay, typography, signage, graphic design, or logo.`;
}

export function buildNativeCopyPrompt(input: {
  title: string;
  body: string;
  language: "bn" | "en";
  brandVoice?: string | null;
  objective?: string | null;
  audience?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
  reviewLanguagePriority?: "bn" | "en";
  strategies: ChannelStrategy[];
}) {
  const languageRule =
    input.language === "bn"
      ? `Write ORIGINAL, natural West Bengal Bengali in Bangla script directly from the source brief.
Do not translate English copy. Avoid literal calques and over-formal textbook Bengali.
Mix languages only where Bengali entertainment audiences naturally would.`
      : `Write ORIGINAL idiomatic English directly from the source brief.
Do not translate Bengali copy.`;
  return `${languageRule}

Brief title: ${input.title}
Brand voice: ${input.brandVoice || "premium Bengali entertainment, warm, cinematic"}
Campaign objective: ${input.objective || "drive qualified viewing intent"}
Audience: ${input.audience || "Bengali entertainment viewers"}
Must include naturally: ${(input.mustInclude || []).join(", ") || "none"}
Forbidden themes/phrases: ${(input.mustAvoid || []).join(", ") || "spoilers"}
Review priority: ${input.reviewLanguagePriority || "bn"}
Brief body:
${input.body}

Channel strategies:
${JSON.stringify(input.strategies, null, 2)}

Produce exactly one package per channel. Respect X <= 260 characters and YouTube title <= 90 characters.`;
}

export function normalizePack(
  raw: Partial<GeneratedChannelPack> & { channel: string }
): GeneratedChannelPack {
  const channel = raw.channel as Channel;
  const spec = PLATFORM_SPECS[channel];
  let copyEn = (raw.copyEn || "").trim();
  let copyBn = (raw.copyBn || "").trim();
  let title = (raw.title || "").trim();
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.map(String).slice(0, spec?.maxHashtags ?? 5)
    : [];

  if (channel === "x") {
    if (copyEn.length > 260) copyEn = copyEn.slice(0, 257) + "...";
    if (copyBn.length > 260) copyBn = copyBn.slice(0, 257) + "...";
  }
  if (channel === "youtube_shorts" && title.length > 90) {
    title = title.slice(0, 87) + "...";
  }

  return {
    channel,
    copyBn: copyBn || "নতুন পর্ব এখন হইছইতে।",
    copyEn: copyEn || "New episode drops now on hoichoi.",
    title: title || undefined,
    hashtags,
    cta: (raw.cta || "Watch on hoichoi").trim(),
    imagePrompt:
      raw.imagePrompt ||
      `Cinematic still for ${channel}, Bengali drama mood, ${spec.aspect}`,
    videoPrompt:
      raw.videoPrompt ||
      `Slow cinematic push in for ${channel}, ${spec.aspect}, 5 seconds`,
    creativeDirection: raw.creativeDirection,
    textProvider: raw.textProvider,
    textModel: raw.textModel,
    generationStrategy: raw.generationStrategy,
    qualityChecks: raw.qualityChecks,
  };
}

export function fallbackPackages(briefTitle: string): GeneratedChannelPack[] {
  return [
    normalizePack({
      channel: "instagram_reels",
      copyBn: `${briefTitle}. আবেগের ঝড়, এখনই হইছইতে দেখুন।`,
      copyEn: `${briefTitle}: feelings hit different. Watch the drop on hoichoi.`,
      hashtags: ["#hoichoi", "#BengaliDrama", "#Reels", "#OTT"],
      cta: "Tap to watch",
      imagePrompt: `Vertical 9:16 cinematic Bengali drama film still, warm tungsten light, intimate close up, film grain, no text, no letters, no logo`,
      videoPrompt: `9:16 vertical reel, slow dolly toward lead actor eyes, soft bokeh lights, 5s, mood for "${briefTitle}"`,
    }),
    normalizePack({
      channel: "youtube_shorts",
      title: `${briefTitle} | New on hoichoi`,
      copyBn: `শর্টসে দেখুন ${briefTitle} এর সেরা মুহূর্ত। সম্পূর্ণ পর্ব হইছইতে।`,
      copyEn: `The moment everyone will rewind. Full episode of ${briefTitle} streaming on hoichoi.`,
      hashtags: ["#Shorts", "#hoichoi", "#Bengali"],
      cta: "Subscribe & watch full episode",
      imagePrompt: `Vertical 9:16 cinematic hook frame, bold expression, high contrast, dramatic sky, no text, no letters, no logo`,
      videoPrompt: `9:16 Shorts cutdown, quick zoom + subtle handheld, 5s hook for "${briefTitle}"`,
    }),
    normalizePack({
      channel: "x",
      copyBn: `${briefTitle} এখন স্ট্রিমিং। এক ক্লিকে হইছইতে।`,
      copyEn: `${briefTitle} is live. Stream now on hoichoi.`,
      hashtags: ["#hoichoi", "#BengaliOTT"],
      cta: "Watch →",
      imagePrompt: `Square 1:1 cinematic social still, centered subject, clean negative space, no text, no letters, no logo`,
      videoPrompt: `1:1 square short video, gentle Ken Burns on key art for "${briefTitle}", 4s`,
    }),
  ];
}
