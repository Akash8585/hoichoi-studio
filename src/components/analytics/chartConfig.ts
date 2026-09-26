/** Series labels and dark theme colors, in the spirit of Evil Charts chartConfig. */
export const channelChartConfig = {
  instagram_reels: {
    label: "Instagram Reels",
    color: "#f77737",
  },
  youtube_shorts: {
    label: "YouTube Shorts",
    color: "#ff4d4d",
  },
  x: {
    label: "X",
    color: "#e4e4e7",
  },
} as const;

export type ChannelKey = keyof typeof channelChartConfig;

export const CHANNEL_ORDER: ChannelKey[] = [
  "instagram_reels",
  "youtube_shorts",
  "x",
];

export const chartAxis = {
  axisLine: { lineStyle: { color: "#262626" } },
  axisTick: { show: false },
  axisLabel: { color: "#a1a1aa", fontSize: 12 },
  splitLine: { lineStyle: { color: "#1a1a1a" } },
  splitArea: { show: false },
};

export const chartTooltip = {
  backgroundColor: "#141414",
  borderColor: "#262626",
  textStyle: { color: "#fafafa", fontSize: 12 },
};

export function channelColor(channel: string) {
  return (
    channelChartConfig[channel as ChannelKey]?.color || "#71717a"
  );
}

/** Compact axis tick labels: 80, 209, 1.2k, 45k, 1.2M. */
export function formatCompactCount(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}${trimOneDecimal(abs / 1_000_000)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${trimOneDecimal(abs / 1_000)}k`;
  }
  return `${sign}${Math.round(abs)}`;
}

function trimOneDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
