/** Soft caps for MVP free-tier safety (stricter than platform adapter maxes). */
export const MVP_MAX_IMAGE_BYTES = 5_000_000;
export const MVP_MAX_VIDEO_BYTES = 25_000_000;

/** Concurrent generate/regenerate lock window. */
export const GENERATION_LOCK_MS = 5 * 60 * 1000;

/** Keep discarded package media this long before lifecycle delete. */
export const DISCARDED_MEDIA_TTL_DAYS = 7;
