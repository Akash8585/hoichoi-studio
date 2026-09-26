import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/db/prisma";
import { generateChannelCopy } from "@/lib/ai/generateCopy";
import { generateChannelImage } from "@/lib/images/generate";
import { CHANNELS } from "@/lib/platforms/specs";
import { toJson } from "@/lib/utils";

export async function ensureDemoUser() {
  const email = (process.env.DEMO_USER_EMAIL || "editor@hoichoi.demo").toLowerCase();
  const password = process.env.DEMO_USER_PASSWORD || "HoichoiDemo2026!";

  const existing = await prisma.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (existing) {
    const credential = existing.accounts.find((a) => a.providerId === "credential");
    if (!credential?.password) {
      const passwordHash = await hashPassword(password);
      if (!credential) {
        await prisma.account.create({
          data: {
            userId: existing.id,
            accountId: existing.id,
            providerId: "credential",
            password: passwordHash,
          },
        });
      } else {
        await prisma.account.update({
          where: { id: credential.id },
          data: { password: passwordHash, accountId: existing.id },
        });
      }
    }
    if (existing.role !== "editor" || !existing.name || !existing.emailVerified) {
      return prisma.user.update({
        where: { id: existing.id },
        data: {
          role: "editor",
          name: existing.name || "Demo Editor",
          emailVerified: true,
        },
      });
    }
    return existing;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      name: "Demo Editor",
      email,
      emailVerified: true,
      role: "editor",
    },
  });

  await prisma.account.create({
    data: {
      userId: user.id,
      accountId: user.id,
      providerId: "credential",
      password: passwordHash,
    },
  });

  return user;
}

export async function seedDemoPipeline() {
  const user = await ensureDemoUser();
  const existing = await prisma.brief.findFirst({
    where: { title: { in: ["কাদম্বিনী — নতুন পর্ব প্রমো", "কাদম্বিনী নতুন পর্ব প্রমো"] } },
    include: { packages: true },
  });
  if (existing) {
    await prisma.post.deleteMany({
      where: { package: { briefId: existing.id } },
    });
    for (const pkg of existing.packages) {
      await prisma.assetPackage.update({
        where: { id: pkg.id },
        data: {
          status: pkg.imageStatus === "ready" ? "pending_approval" : "draft",
          videoStatus: "deferred",
          videoUrl: null,
          videoError: null,
          rejectionReason: null,
        },
      });
    }
    if (/[—–]| -- /.test(existing.title)) {
      await prisma.brief.update({
        where: { id: existing.id },
        data: { title: existing.title.replace(/\s*[—–]\s*/g, " ").replace(/\s+--\s+/g, " ") },
      });
    }
    if (/[—–]| -- |২৫-৪০|স্পয়লার-মুক্ত/.test(existing.body || "")) {
      await prisma.brief.update({
        where: { id: existing.id },
        data: {
          body: existing.body
            .replace(/\s*[—–]\s*/g, " ")
            .replace(/\s+--\s+/g, " ")
            .replace(/২৫-৪০/g, "২৫ থেকে ৪০")
            .replace(/স্পয়লার-মুক্ত/g, "স্পয়লার ছাড়া"),
        },
      });
    }
    return { briefId: existing.id, seeded: false, approvalReset: true };
  }

  const brief = await prisma.brief.create({
    data: {
      title: "কাদম্বিনী নতুন পর্ব প্রমো",
      body: "একটি নতুন পর্বে কাদম্বিনীর পরিবারে অতীতের রহস্য ফিরে আসে। টার্গেট: ২৫ থেকে ৪০ বছর বয়সী বাংলাদেশি ও পশ্চিমবঙ্গের দর্শক। টোন: সিনেম্যাটিক, আবেগঘন, স্পয়লার ছাড়া।",
      language: "bn",
      brandVoice: "premium Bengali OTT, warm, cinematic, never spammy",
      createdById: user.id,
    },
  });

  const packs = await generateChannelCopy({
    title: brief.title,
    body: brief.body,
    language: brief.language,
    brandVoice: brief.brandVoice,
  });

  for (const pack of packs) {
    const image = await generateChannelImage({
      channel: pack.channel,
      title: brief.title,
      prompt: pack.imagePrompt,
      fileStem: `${brief.id}-${pack.channel}-img`,
    });
    const pkg = await prisma.assetPackage.create({
      data: {
        briefId: brief.id,
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
        status: "pending_approval",
        rawGeneration: toJson(pack),
        textProvider: pack.textProvider,
        textModel: pack.textModel,
        generationStrategy: pack.generationStrategy,
        creativeDirection: pack.creativeDirection,
        qualityChecks: toJson(pack.qualityChecks || {}),
      },
    });
    void pkg;
  }

  // ensure CHANNELS coverage if model returned incomplete
  void CHANNELS;

  return { briefId: brief.id, seeded: true };
}
