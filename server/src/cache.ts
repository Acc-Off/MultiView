import { getKv, setKv } from "./db.js";
import type { VideoItem } from "./types.js";

/**
 * Cache of live and scheduled streams.
 *
 * This was originally in-memory only (lost on restart). But when running with polling_enabled=false
 * and frequent Docker restarts, every startup needed a manual refresh to re-fetch live streams,
 * spending quota each time, which violated the design principle of not calling external APIs on restart.
 * So the cache is persisted as JSON in the kv table and restored on first access after startup.
 *
 * YouTube and Twitch are polled at different intervals, so the cache is kept per platform.
 * This way, when a YouTube fetch fails because the quota is exceeded, the previous YouTube
 * result is kept while Twitch alone keeps updating (getLive() merges the two and returns them).
 *
 * Archives are persisted in the archive_videos table, so they are not handled here.
 */

const KV_KEY_YOUTUBE = "live_cache_youtube";
const KV_KEY_TWITCH = "live_cache_twitch";

/** Per-platform live cache. null means not fetched yet (as distinct from a fetched empty array). */
let ytItems: VideoItem[] | null = null;
let twItems: VideoItem[] | null = null;
/** Whether a restore from the DB has been attempted (a flag to avoid a SELECT on every access). */
let restored = false;

/** Parses a raw kv value into VideoItem[]. Returns null (treated as not fetched) if it is corrupt. */
function parseItems(raw: string | null): VideoItem[] | null {
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as VideoItem[];
  } catch {
    return null;
  }
}

/** Restores from kv on first access. After that, the in-memory copy is the source of truth. */
function ensureRestored(): void {
  if (restored) return;
  restored = true;
  ytItems = parseItems(getKv(KV_KEY_YOUTUBE));
  twItems = parseItems(getKv(KV_KEY_TWITCH));
}

/**
 * Returns the live and scheduled stream cache (YouTube and Twitch merged).
 * Returns null if neither has been fetched. If only one has been fetched, returns just that one.
 */
export function getLive(): VideoItem[] | null {
  ensureRestored();
  if (ytItems === null && twItems === null) return null;
  return [...(ytItems ?? []), ...(twItems ?? [])];
}

/** Replaces the YouTube live and scheduled stream cache (in memory, and persisted to kv). */
export function setYouTubeLive(items: VideoItem[]): void {
  // Restore both platforms from kv before replacing. Setting restored=true directly would skip the kv
  // restore of the other platform when the first fetch after startup covers only one of them, and that platform
  // would disappear from the list until its next poll (seen as YouTube streams vanishing right after a restart).
  ensureRestored();
  ytItems = items;
  setKv(KV_KEY_YOUTUBE, JSON.stringify(items));
}

/** Replaces the Twitch live cache (in memory, and persisted to kv). */
export function setTwitchLive(items: VideoItem[]): void {
  ensureRestored(); // Same as above (do not skip the kv restore of the YouTube side)
  twItems = items;
  setKv(KV_KEY_TWITCH, JSON.stringify(items));
}

/** Whether either platform has a cached result (as distinct from null, meaning not fetched yet). */
export function hasLive(): boolean {
  ensureRestored();
  return ytItems !== null || twItems !== null;
}

/** Clears the cache, for tests and channel configuration changes (resets both platforms to not fetched). */
export function clearLive(): void {
  restored = true;
  ytItems = null;
  twItems = null;
  setKv(KV_KEY_YOUTUBE, JSON.stringify(null));
  setKv(KV_KEY_TWITCH, JSON.stringify(null));
}
