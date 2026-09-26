import { z } from "zod";

export const createBriefSchema = z.object({
  title: z.string().min(2).max(200),
  body: z.string().min(10).max(8000),
  language: z.enum(["bn", "en", "both"]).default("both"),
  brandVoice: z.string().max(1000).optional(),
  objective: z.string().max(1000).optional(),
  audience: z.string().max(1000).optional(),
  mustInclude: z.array(z.string().max(120)).max(20).default([]),
  mustAvoid: z.array(z.string().max(120)).max(20).default([]),
  reviewLanguagePriority: z.enum(["bn", "en"]).default("bn"),
  sourceReportId: z.string().optional(),
});

export const scheduleSchema = z.object({
  scheduledAt: z.string().datetime().or(z.string().min(1)),
});

export const patchPackageSchema = z.object({
  copyBn: z.string().max(4000).optional(),
  copyEn: z.string().max(4000).optional(),
  title: z.string().max(200).nullable().optional(),
  cta: z.string().max(200).nullable().optional(),
  hashtags: z.array(z.string().max(60)).max(40).optional(),
  reviewNotes: z.string().max(1000).nullable().optional(),
});

export const weeklyReportSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
});
