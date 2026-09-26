import { prisma } from "@/lib/db/prisma";
import { generateChannelCopy } from "@/lib/ai/generateCopy";
import {
  evaluateGenerationQuality,
  reconcileQualityChecks,
} from "@/lib/ai/quality";
import type { GeneratedChannelPack } from "@/lib/ai/prompts";
import { generateChannelImage } from "@/lib/images/generate";
import { parseJsonArray, toJson } from "@/lib/utils";
import type { Channel } from "@/lib/platforms/specs";
import { deleteMediaByUrl } from "@/lib/storage";
import {
  acquireBriefGenerationLock,
  acquirePackageGenerationLock,
  releaseBriefGenerationLock,
  releasePackageGenerationLock,
} from "@/lib/storage/locks";

function packageAsGeneratedPack(row: {
  channel: string;
  copyBn: string | null;
  copyEn: string | null;
  title: string | null;
  hashtags: string | null;
  cta: string | null;
  imagePrompt: string | null;
  videoPrompt: string | null;
}): GeneratedChannelPack {
  return {
    channel: row.channel as Channel,
    copyBn: row.copyBn || "",
    copyEn: row.copyEn || "",
    title: row.title || undefined,
    hashtags: parseJsonArray(row.hashtags),
    cta: row.cta || "",
    imagePrompt: row.imagePrompt || "",
    videoPrompt: row.videoPrompt || "",
  };
}

function qualityPayloadForStore(
  joint: Record<string, unknown>,
  previousRaw?: string | null,
  options?: { preserveHumanReview?: boolean }
) {
  let previous: Record<string, unknown> = {};
  try {
    previous = JSON.parse(previousRaw || "{}") as Record<string, unknown>;
  } catch {
    previous = {};
  }
  const keepReview =
    options?.preserveHumanReview && previous.requiresHumanReview === true;
  return reconcileQualityChecks({
    ...joint,
    ...(keepReview
      ? {
          requiresHumanReview: true,
          providerError: previous.providerError,
        }
      : {}),
  });
}

export async function runBriefGeneration(briefId: string) {
  await acquireBriefGenerationLock(briefId);
  try {
    const brief = await prisma.brief.findUnique({ where: { id: briefId } });
    if (!brief) throw new Error("Brief not found");

    const packs = await generateChannelCopy({
      title: brief.title,
      body: brief.body,
      language: brief.language,
      brandVoice: brief.brandVoice,
      objective: brief.objective,
      audience: brief.audience,
      mustInclude: parseJsonArray(brief.mustInclude),
      mustAvoid: parseJsonArray(brief.mustAvoid),
      reviewLanguagePriority: brief.reviewLanguagePriority as "bn" | "en",
    });

    await Promise.all(packs.map(async (pack) => {
      const existing = await prisma.assetPackage.findUnique({
        where: {
          briefId_channel: { briefId, channel: pack.channel },
        },
      });
      if (existing) {
        await deleteMediaByUrl(existing.imageUrl);
        await deleteMediaByUrl(existing.videoUrl);
        if (existing.videoUrl?.endsWith(".mp4")) {
          await deleteMediaByUrl(
            existing.videoUrl.replace(/\.mp4$/, ".motion.svg")
          );
        }
      }

      const image = await generateChannelImage({
        channel: pack.channel as Channel,
        title: brief.title,
        prompt: pack.imagePrompt,
        fileStem: `${briefId}-${pack.channel}-${Date.now()}-img`,
      });

      const qualityChecks = toJson(
        reconcileQualityChecks(
          (pack.qualityChecks || {}) as Record<string, unknown>
        )
      );

      await prisma.assetPackage.upsert({
        where: {
          briefId_channel: { briefId, channel: pack.channel },
        },
        create: {
          briefId,
          channel: pack.channel,
          copyBn: pack.copyBn,
          copyEn: pack.copyEn,
          title: pack.title,
          hashtags: toJson(pack.hashtags),
          cta: pack.cta,
          imagePrompt: pack.imagePrompt,
          videoPrompt: pack.videoPrompt,
          imageUrl: image.url,
          imageWidth: image.width,
          imageHeight: image.height,
          imageBytes: image.bytes,
          imageStatus: image.compliant ? "ready" : "placeholder",
          imageProvider: image.provider,
          imageModel: image.model,
          videoStatus: "deferred",
          status: "draft",
          rawGeneration: toJson(pack),
          textProvider: pack.textProvider,
          textModel: pack.textModel,
          generationStrategy: pack.generationStrategy,
          creativeDirection: pack.creativeDirection,
          qualityChecks,
        },
        update: {
          copyBn: pack.copyBn,
          copyEn: pack.copyEn,
          title: pack.title,
          hashtags: toJson(pack.hashtags),
          cta: pack.cta,
          imagePrompt: pack.imagePrompt,
          videoPrompt: pack.videoPrompt,
          imageUrl: image.url,
          imageWidth: image.width,
          imageHeight: image.height,
          imageBytes: image.bytes,
          imageStatus: image.compliant ? "ready" : "placeholder",
          imageProvider: image.provider,
          imageModel: image.model,
          videoUrl: null,
          videoStatus: "deferred",
          videoError: null,
          videoAttempts: 0,
          status: "draft",
          rejectionReason: null,
          rawGeneration: toJson(pack),
          textProvider: pack.textProvider,
          textModel: pack.textModel,
          generationStrategy: pack.generationStrategy,
          creativeDirection: pack.creativeDirection,
          qualityChecks,
          revision: { increment: 1 },
        },
      });
    }));

    return prisma.brief.findUnique({
      where: { id: briefId },
      include: { packages: true },
    });
  } finally {
    await releaseBriefGenerationLock(briefId);
  }
}

export async function regeneratePackage(packageId: string) {
  await acquirePackageGenerationLock(packageId);
  try {
    const pkg = await prisma.assetPackage.findUnique({
      where: { id: packageId },
      include: { brief: true },
    });
    if (!pkg) throw new Error("Package not found");

    await deleteMediaByUrl(pkg.imageUrl);
    await deleteMediaByUrl(pkg.videoUrl);
    if (pkg.videoUrl?.endsWith(".mp4")) {
      await deleteMediaByUrl(pkg.videoUrl.replace(/\.mp4$/, ".motion.svg"));
    }

    const packs = await generateChannelCopy({
      title: pkg.brief.title,
      body: `${pkg.brief.body}${
        pkg.reviewNotes ? `\n\nHuman review feedback: ${pkg.reviewNotes}` : ""
      }`,
      language: pkg.brief.language,
      brandVoice: pkg.brief.brandVoice,
      objective: pkg.brief.objective,
      audience: pkg.brief.audience,
      mustInclude: parseJsonArray(pkg.brief.mustInclude),
      mustAvoid: parseJsonArray(pkg.brief.mustAvoid),
      reviewLanguagePriority: pkg.brief.reviewLanguagePriority as "bn" | "en",
    });
    const pack = packs.find((p) => p.channel === pkg.channel) || packs[0];

    const image = await generateChannelImage({
      channel: pkg.channel as Channel,
      title: pkg.brief.title,
      prompt: pack.imagePrompt,
      fileStem: `${pkg.id}-regen-${Date.now()}-img`,
    });

    const siblings = await prisma.assetPackage.findMany({
      where: { briefId: pkg.briefId, id: { not: packageId } },
    });
    const jointQuality = evaluateGenerationQuality(
      [...siblings.map(packageAsGeneratedPack), pack],
      {
        briefBody: pkg.brief.body,
        mustInclude: parseJsonArray(pkg.brief.mustInclude),
        mustAvoid: parseJsonArray(pkg.brief.mustAvoid),
      }
    );

    const updated = await prisma.assetPackage.update({
      where: { id: packageId },
      data: {
        copyBn: pack.copyBn,
        copyEn: pack.copyEn,
        title: pack.title,
        hashtags: toJson(pack.hashtags),
        cta: pack.cta,
        imagePrompt: pack.imagePrompt,
        videoPrompt: pack.videoPrompt,
        imageUrl: image.url,
        imageWidth: image.width,
        imageHeight: image.height,
        imageBytes: image.bytes,
        imageStatus: image.compliant ? "ready" : "placeholder",
        imageProvider: image.provider,
        imageModel: image.model,
        videoUrl: null,
        videoStatus: "deferred",
        videoError: null,
        videoAttempts: 0,
        status: "draft",
        rejectionReason: null,
        rawGeneration: toJson(pack),
        textProvider: pack.textProvider,
        textModel: pack.textModel,
        generationStrategy: pack.generationStrategy,
        creativeDirection: pack.creativeDirection,
        qualityChecks: toJson(qualityPayloadForStore(jointQuality)),
        reviewNotes: null,
        revision: { increment: 1 },
      },
    });

    const updatedSiblings = await Promise.all(
      siblings.map((sibling) =>
        prisma.assetPackage.update({
          where: { id: sibling.id },
          data: {
            qualityChecks: toJson(
              qualityPayloadForStore(jointQuality, sibling.qualityChecks, {
                preserveHumanReview: true,
              })
            ),
          },
        })
      )
    );

    return { package: updated, siblings: updatedSiblings };
  } finally {
    await releasePackageGenerationLock(packageId);
  }
}
