export type Channel = "instagram_reels" | "youtube_shorts" | "x";

export type PlatformSpec = {
  label: string;
  aspect: "9:16" | "1:1" | "16:9";
  w: number;
  h: number;
  maxCaption?: number;
  maxTitle?: number;
  maxDesc?: number;
  maxText?: number;
  maxHashtags: number;
  maxImageBytes: number;
  tone: string;
  video: {
    required: boolean;
    maxDurationSec: number;
    maxBytes: number;
    mime: "video/mp4";
    aspect: "9:16" | "1:1" | "16:9";
  };
};

export const CHANNELS: Channel[] = [
  "instagram_reels",
  "youtube_shorts",
  "x",
];

export const PLATFORM_SPECS: Record<Channel, PlatformSpec> = {
  instagram_reels: {
    label: "Instagram Reels",
    aspect: "9:16",
    w: 1080,
    h: 1920,
    maxCaption: 2200,
    maxHashtags: 30,
    maxImageBytes: 8_000_000,
    tone: "warm, visual, light on emoji, community CTA",
    video: {
      required: false,
      maxDurationSec: 90,
      maxBytes: 100_000_000,
      mime: "video/mp4",
      aspect: "9:16",
    },
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    aspect: "9:16",
    w: 1080,
    h: 1920,
    maxTitle: 100,
    maxDesc: 5000,
    maxHashtags: 15,
    maxImageBytes: 8_000_000,
    tone: "lead with the hook in the title, discovery keywords, subscribe CTA",
    video: {
      required: false,
      maxDurationSec: 60,
      maxBytes: 100_000_000,
      mime: "video/mp4",
      aspect: "9:16",
    },
  },
  x: {
    label: "X",
    aspect: "1:1",
    w: 1080,
    h: 1080,
    maxText: 280,
    maxHashtags: 5,
    maxImageBytes: 5_000_000,
    tone: "punchy, conversational, minimal hashtags, CTA that reads like a link",
    video: {
      required: false,
      maxDurationSec: 140,
      maxBytes: 512_000_000,
      mime: "video/mp4",
      aspect: "1:1",
    },
  },
};

export function aspectRatioValue(aspect: PlatformSpec["aspect"]): number {
  if (aspect === "9:16") return 9 / 16;
  if (aspect === "16:9") return 16 / 9;
  return 1;
}
