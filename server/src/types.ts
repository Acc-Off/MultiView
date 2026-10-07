/**
 * The minimal set of video fields returned to the frontend.
 * The Holodex-specific fields that Holodex's VideoCard.vue references (clips/songcount/live_tl_count/
 * live_viewers/placeholderType/certainty/channel.org/group/type/english_name) are all
 * guarded by v-if / optional chaining, so leaving them out here automatically hides
 * the corresponding UI. Only the minimum is kept, to strip out Holodex-specific elements.
 */
export interface VideoItem {
  id: string;
  title: string;
  type: "stream" | "placeholder" | "video"; // Holodex-compatible. MultiView does not use "placeholder"
  status: "live" | "upcoming" | "past";
  topic_id?: string;
  published_at: string;
  /**
   * Reference time for display (a Holodex-compatible field). Widely referenced by the frontend
   * (the date/time display in VideoCard, sorting in functions.js, MultiviewSyncBar, etc.).
   * Set to start_actual ?? start_scheduled ?? published_at.
   * Added when shaping the response (withAvailableAt).
   */
  available_at?: string;
  start_scheduled?: string;
  start_actual?: string;
  end_actual?: string;
  duration?: number;
  thumbnail: string; // Video thumbnail URL (for YouTube, generated as i.ytimg.com/vi/{id}/hqdefault.jpg)
  channel: {
    id: string;
    platform: "youtube" | "twitch";
    name: string;
    // Channel icons are served only by GET /api/channels (the frontend looks them up by id).
    // They are not included in live / archive responses.
  };
}

/** Response envelope of GET /api/videos/live and /api/videos/archive */
export interface VideosResponse {
  items: VideoItem[];
  last_updated: string | null; // Last fetch time of the target (ISO8601). Used for the "last fetched" time in the UI
}

/**
 * Refresh targets (internal). Live is split into separate YouTube / Twitch targets that are polled
 * at different intervals (YouTube consumes quota while Twitch is unlimited, so their frequencies should differ).
 * - live_youtube = YouTube live and scheduled streams
 * - live_twitch  = Twitch live streams
 * - archive      = YouTube archives
 * In the external API vocabulary (POST /api/refresh?target=live|archive|all, and live/archive in
 * GET /api/refresh/status), live_youtube and live_twitch are aggregated into "live".
 */
export type RefreshTarget = "live_youtube" | "live_twitch" | "archive";

/** External refresh targets. live = YouTube + Twitch live / archive / all = both */
export type ExternalTarget = "live" | "archive" | "all";

/** Refresh state the refresher holds per target. Keeping it in memory is enough (reset on restart). */
export interface RefreshState {
  status: "idle" | "running";
  last_updated: string | null; // Time of the last success (ISO8601)
  last_error: string | null; // Reason for the last failure (if any)
  started_at: string | null; // Start time of the current job (while running)
}

/** Response of GET /api/refresh/status */
export interface RefreshStatusResponse {
  live: RefreshState;
  archive: RefreshState;
}

/** Response of GET /api/quota */
export interface QuotaState {
  date: string; // "YYYY-MM-DD" (Pacific Time = the basis for YouTube's reset)
  used: number; // Approximate units consumed today
  limit: number; // Upper limit
  last_call_at: string | null;
  exceeded: boolean; // Whether the limit has been reached
}

/** An arbitrary link shown at the bottom of the hamburger menu, etc. (same shape as site_links in config.yaml). */
export interface SiteLink {
  label: string;
  url: string;
  icon?: string;
}

/** Response of GET /api/config/public (contains no secret values) */
export interface PublicConfig {
  public_refresh_enabled: boolean;
  /** Service name chosen by the operator. "" if unset (the frontend falls back to the default "MultiView"). */
  site_name: string;
  /** Arbitrary links shown at the bottom of the hamburger menu. [] if unset. */
  site_links: SiteLink[];
}
