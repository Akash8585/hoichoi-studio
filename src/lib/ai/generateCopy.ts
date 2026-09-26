import {
  buildNativeCopyPrompt,
  buildStrategyPrompt,
  fallbackPackages,
  normalizePack,
  type ChannelStrategy,
  type GeneratedChannelPack,
} from "@/lib/ai/prompts";
import { CHANNELS } from "@/lib/platforms/specs";
import { generateStructured } from "@/lib/ai/providers";
import { evaluateGenerationQuality } from "@/lib/ai/quality";
import { z } from "zod";

const channelEnum = z.enum(["instagram_reels", "youtube_shorts", "x"]);

const strategySchema = z.object({
  strategies: z
    .array(
      z.object({
        channel: channelEnum,
        tone: z.string().min(3),
        ctaStyle: z.string().min(3),
        hashtagConvention: z.string().min(3),
        visualComposition: z.string().min(10),
        videoMotion: z.string().min(5),
      })
    )
    .length(3),
});

const copySchema = z.object({
  packages: z
    .array(
      z.object({
        channel: channelEnum,
        copy: z.string().min(3),
        title: z.string().optional(),
        hashtags: z.array(z.string()).max(30),
        cta: z.string().min(2),
      })
    )
    .length(3),
});

const strategyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["strategies"],
  properties: {
    strategies: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "channel",
          "tone",
          "ctaStyle",
          "hashtagConvention",
          "visualComposition",
          "videoMotion",
        ],
        properties: {
          channel: { type: "string", enum: CHANNELS },
          tone: { type: "string" },
          ctaStyle: { type: "string" },
          hashtagConvention: { type: "string" },
          visualComposition: { type: "string" },
          videoMotion: { type: "string" },
        },
      },
    },
  },
};

const copyJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["packages"],
  properties: {
    packages: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["channel", "copy", "hashtags", "cta"],
        properties: {
          channel: { type: "string", enum: CHANNELS },
          copy: { type: "string" },
          title: { type: "string" },
          hashtags: { type: "array", items: { type: "string" } },
          cta: { type: "string" },
        },
      },
    },
  },
};

async function generateNative(
  input: {
    title: string;
    body: string;
    language: string;
    brandVoice?: string | null;
    objective?: string | null;
    audience?: string | null;
    mustInclude?: string[];
    mustAvoid?: string[];
    reviewLanguagePriority?: "bn" | "en";
  },
  strategies: ChannelStrategy[],
  language: "bn" | "en",
  repairNote?: string
) {
  return generateStructured({
    schemaName: `${language}_channel_copy`,
    schema: copyJsonSchema,
    validate: (value) => copySchema.parse(value),
    messages: [
      {
        role: "system",
        content:
          language === "bn"
            ? "You are a native Bengali entertainment copywriter from West Bengal. Never translate from English."
            : "You are a native English entertainment copywriter. Never translate from Bengali.",
      },
      {
        role: "user",
        content:
          buildNativeCopyPrompt({
            ...input,
            language,
            strategies,
          }) + (repairNote ? `\nRepair requirement: ${repairNote}` : ""),
      },
    ],
  });
}

async function generateWithProviders(input: {
  title: string;
  body: string;
  language: string;
  brandVoice?: string | null;
  objective?: string | null;
  audience?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
  reviewLanguagePriority?: "bn" | "en";
}) {
  const strategy = await generateStructured({
    schemaName: "channel_strategy",
    schema: strategyJsonSchema,
    validate: (value) => strategySchema.parse(value),
    messages: [
      {
        role: "system",
        content:
          "You are a creative strategist working across platforms. Make channel outputs visibly and linguistically different.",
      },
      { role: "user", content: buildStrategyPrompt(input) },
    ],
  });

  const first = await Promise.all([
    generateNative(input, strategy.data.strategies, "bn"),
    generateNative(input, strategy.data.strategies, "en"),
  ]);

  const merge = (
    bn: typeof first[number],
    en: typeof first[number]
  ): GeneratedChannelPack[] => {
    const bnMap = new Map(bn.data.packages.map((pack) => [pack.channel, pack]));
    const enMap = new Map(en.data.packages.map((pack) => [pack.channel, pack]));
    const briefContext = [
      input.body,
      input.objective && `Objective: ${input.objective}`,
      input.audience && `Audience: ${input.audience}`,
      input.mustInclude?.length && `Must include: ${input.mustInclude.join(", ")}`,
      input.mustAvoid?.length && `Avoid: ${input.mustAvoid.join(", ")}`,
    ]
      .filter(Boolean)
      .join(". ")
      .slice(0, 1000);
    return strategy.data.strategies.map((direction) => {
      const bengali = bnMap.get(direction.channel)!;
      const english = enMap.get(direction.channel)!;
      const visualScene = direction.visualComposition.replace(
        /\b(poster|key art|thumbnail|title card|text overlay|typography|graphic design|logo)\b/gi,
        "cinematic film still"
      );
      return normalizePack({
        channel: direction.channel,
        copyBn: bengali.copy,
        copyEn: english.copy,
        title: english.title || bengali.title,
        hashtags: english.hashtags,
        cta: english.cta,
        creativeDirection: JSON.stringify(direction),
        imagePrompt: `Photorealistic cinematic film still, not a poster. ${visualScene}. ${direction.tone}. Story context: ${briefContext}. Channel composition: ${direction.channel}. Pure photographic scene only: no text, no letters, no captions, no typography, no title, no logo, no watermark, no signage, no cropped faces. Obey all required and forbidden constraints.`,
        videoPrompt: `${direction.videoMotion}. ${direction.visualComposition}. A five second cinematic promo for "${input.title}", ${direction.tone}. Source brief: ${briefContext}. Obey all required and forbidden constraints.`,
        textProvider: `${strategy.provider},${bn.provider},${en.provider}`,
        textModel: `${strategy.model},${bn.model},${en.model}`,
        generationStrategy: "independent-source-brief-generation",
      });
    });
  };

  let packs = merge(first[0], first[1]);
  const qualityContext = {
    briefBody: input.body,
    mustInclude: input.mustInclude,
    mustAvoid: input.mustAvoid,
  };
  let quality = evaluateGenerationQuality(packs, qualityContext);
  if (!quality.passed) {
    const repair = await Promise.all([
      generateNative(
        input,
        strategy.data.strategies,
        "bn",
        "Increase native Bangla script usage and make all three channels more distinct."
      ),
      generateNative(
        input,
        strategy.data.strategies,
        "en",
        "Make CTA, copy length and vocabulary clearly different for all three channels."
      ),
    ]);
    packs = merge(repair[0], repair[1]);
    quality = evaluateGenerationQuality(packs, qualityContext);
  }
  return packs.map((pack) => ({ ...pack, qualityChecks: quality }));
}

export async function generateChannelCopy(input: {
  title: string;
  body: string;
  language: string;
  brandVoice?: string | null;
  objective?: string | null;
  audience?: string | null;
  mustInclude?: string[];
  mustAvoid?: string[];
  reviewLanguagePriority?: "bn" | "en";
}): Promise<GeneratedChannelPack[]> {
  try {
    return await generateWithProviders(input);
  } catch (error) {
    const packs = fallbackPackages(input.title);
    const quality = evaluateGenerationQuality(packs, {
      briefBody: input.body,
      mustInclude: input.mustInclude,
      mustAvoid: input.mustAvoid,
    });
    return packs.map((pack) => ({
      ...pack,
      textProvider: "deterministic-fallback",
      textModel: "native-template-v1",
      generationStrategy: "independent-fallback-copy",
      qualityChecks: {
        ...quality,
        providerError: (error as Error).message,
        requiresHumanReview: true,
      },
    }));
  }
}
