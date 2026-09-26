import { hashSeed } from "@/lib/utils";

export const METRIC_SOURCE = "simulated" as const;

export function seedMetrics(postId: string, tick = 0) {
  const base = hashSeed(postId);
  const growth = 1 + tick * 0.12;
  const views = Math.floor((800 + (base % 4200)) * growth);
  const likes = Math.floor(views * (0.04 + (base % 30) / 1000));
  const comments = Math.floor(likes * (0.08 + (base % 20) / 1000));
  const shares = Math.floor(likes * (0.05 + (base % 15) / 1000));
  const saves = Math.floor(likes * (0.06 + (base % 25) / 1000));
  const ctr = Number((0.01 + (base % 40) / 1000).toFixed(4));
  return { views, likes, comments, shares, saves, ctr };
}
