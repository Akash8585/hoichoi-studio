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
Also return sceneWorld: one English sentence, about 25 to 40 words, that translates the brief into things a camera can see. Name the place, weather, objects, and people. Use the title and must include list. If the brief is Bengali, translate the visible scene into English. Do not mention captions, hashtags, logos, or the platform name.

Each visualComposition is a different camera on that SAME sceneWorld, written in English. Repeat the concrete subjects from sceneWorld in every visualComposition. Do not invent a different story. Do not fall back to a rainy car windshield, a generic alley, or a portrait unless the brief itself describes that.

The visualComposition must describe a photographic film scene only. Never request a poster,
key art, thumbnail, title card, text overlay, typography, signage, graphic design, or logo.`;
}

const NON_VISUAL =
  /\b(hoichoi|watch now|subscribe|streaming|tonight on|cta|hashtag)\b/i;

const CHANNEL_FRAMING: Record<Channel, string> = {
  instagram_reels:
    "Vertical 9:16, intimate medium shot, subject low in the frame, shallow depth of field",
  youtube_shorts:
    "Vertical 9:16, wide establishing shot, sky and place fill the upper frame",
  x: "Square 1:1, subject centered, more negative space around them",
};

export function visualSubjectLine(input: {
  title: string;
  mustInclude?: string[];
}) {
  const english = (input.mustInclude || [])
    .map((item) => item.trim())
    .filter((item) => item && !NON_VISUAL.test(item));
  const title = input.title.trim();
  return [...english, title].filter(Boolean).join(", ");
}

export function buildChannelImagePrompt(input: {
  channel: Channel;
  title: string;
  mustInclude?: string[];
  mustAvoid?: string[];
  sceneWorld: string;
  visualComposition: string;
  tone?: string;
}) {
  const avoid = (input.mustAvoid || [])
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  const lead = [
    visualSubjectLine(input),
    input.sceneWorld.trim(),
    input.visualComposition.trim(),
    input.tone?.trim(),
    CHANNEL_FRAMING[input.channel],
  ]
    .filter(Boolean)
    .join(". ");
  const tail =
    "Photorealistic cinematic film still of that exact scene. No text, no letters, no logo, no watermark, no poster.";
  const without = avoid.length ? ` Do not depict: ${avoid.join(", ")}.` : "";
  return `${lead}. ${tail}${without}`.slice(0, 900);
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

export function fallbackPackages(
  briefTitle: string,
  extras?: { body?: string; mustInclude?: string[]; mustAvoid?: string[] }
): GeneratedChannelPack[] {
  const sceneWorld = [extras?.body, briefTitle].filter(Boolean).join(". ").slice(0, 320);
  const shared = {
    title: briefTitle,
    mustInclude: extras?.mustInclude,
    mustAvoid: extras?.mustAvoid,
    sceneWorld: sceneWorld || briefTitle,
  };
  return [
    normalizePack({
      channel: "instagram_reels",
      copyBn: `${briefTitle}. আবেগের ঝড়, এখনই হইছইতে দেখুন।`,
      copyEn: `${briefTitle}: feelings hit different. Watch the drop on hoichoi.`,
      hashtags: ["#hoichoi", "#BengaliDrama", "#Reels", "#OTT"],
      cta: "Tap to watch",
      imagePrompt: buildChannelImagePrompt({
        ...shared,
        channel: "instagram_reels",
        visualComposition: "People and place from the brief, seen up close",
      }),
      videoPrompt: `9:16 vertical reel of ${sceneWorld}, 5 seconds`,
    }),
    normalizePack({
      channel: "youtube_shorts",
      title: `${briefTitle} | New on hoichoi`,
      copyBn: `শর্টসে দেখুন ${briefTitle} এর সেরা মুহূর্ত। সম্পূর্ণ পর্ব হইছইতে।`,
      copyEn: `The moment everyone will rewind. Full episode of ${briefTitle} streaming on hoichoi.`,
      hashtags: ["#Shorts", "#hoichoi", "#Bengali"],
      cta: "Subscribe & watch full episode",
      imagePrompt: buildChannelImagePrompt({
        ...shared,
        channel: "youtube_shorts",
        visualComposition: "Wide view of the place and weather from the brief",
      }),
      videoPrompt: `9:16 Shorts of ${sceneWorld}, 5 second hook`,
    }),
    normalizePack({
      channel: "x",
      copyBn: `${briefTitle} এখন স্ট্রিমিং। এক ক্লিকে হইছইতে।`,
      copyEn: `${briefTitle} is live. Stream now on hoichoi.`,
      hashtags: ["#hoichoi", "#BengaliOTT"],
      cta: "Watch →",
      imagePrompt: buildChannelImagePrompt({
        ...shared,
        channel: "x",
        visualComposition: "Centered view of the main subject from the brief",
      }),
      videoPrompt: `1:1 short video of ${sceneWorld}, 4 seconds`,
    }),
  ];
}
