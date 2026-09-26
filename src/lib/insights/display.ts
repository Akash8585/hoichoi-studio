const CHANNEL_LABELS: Record<string, string> = {
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  x: "X",
};

export function channelLabel(channel: string) {
  return CHANNEL_LABELS[channel] || channel.replaceAll("_", " ");
}

/** Strip stored database ids from insight copy so the page stays readable. */
export function humanizeClaim(text: string) {
  return text
    .replace(/(\d)\s*[-–—]\s*(\d)/g, "$1 to $2")
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\s+--\s+/g, ". ")
    .replace(/\s+-\s+/g, ". ")
    .replace(/^\s*[-–—.•]+\s*/, "")
    .replace(/^\.\s*/, "")
    .replace(/\blike-for-like\b/gi, "side by side")
    .replace(/\bweek-by-week\b/gi, "week by week")
    .replace(/\bchannel-specific\b/gi, "for each channel")
    .replace(/\bcross-platform\b/gi, "across platforms")
    .replace(/\bhook-first\b/gi, "hook first")
    .replace(/instagram_reels/gi, "Instagram Reels")
    .replace(/youtube_shorts/gi, "YouTube Shorts")
    .replace(/title hint/gi, "title")
    .replace(/\([^)]*\b[a-z][a-z0-9]{16,}[^)]*\)/gi, "")
    .replace(/['"][a-z][a-z0-9]{16,}['"]/gi, "")
    .replace(/\b(?:posts?|with)\s+IDs?\b/gi, "")
    .replace(/\bIDs?\b/gi, "")
    .replace(/\bpost:[a-z0-9]+\b/gi, "")
    .replace(/\b[a-z][a-z0-9]{20,}\b/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.])/g, "$1")
    .trim();
}
