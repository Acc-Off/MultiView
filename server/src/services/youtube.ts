import type { ArchiveVideoRow } from "../db.js";
import { getQuota, QUOTA_COST } from "../quota.js";
import { getConfig } from "../state.js";
import { getChannelsByPlatform, setChannelDisplayName, setChannelHandle, setChannelThumbnail } from "./channels.js";
import { downloadThumbnail } from "./thumbnails.js";
import { youtubeThumbnail } from "./archive.js";
import type { VideoItem } from "../types.js";

/**
 * YouTube Data API v3 integration.
 *
 * The expensive search.list (100 units per call) is not used; data is fetched with this low-cost approach instead:
 *   1. playlistItems.list (the uploads playlist, "UC" → "UU") for each channel's latest video IDs … 1 unit per channel
 *   2. videos.list (snippet,liveStreamingDetails,status) to batch-fetch the details … 1 unit per 50 videos
 * snippet.liveBroadcastContent is used to sort them into live / upcoming / none (= archive candidates).
 *
 * The quota is checked with quota.canSpend() right before each API call; if it would be exceeded, the call is skipped and
 * an error is thrown (polling moves on to the next cycle; a manual refresh records last_error). After a call, quota.spend() adds the cost.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

/** The uploads playlist ID is the channel ID with "UC" replaced by "UU". */
function uploadsPlaylistId(channelId: string): string {
  return channelId.startsWith("UC") ? "UU" + channelId.slice(2) : channelId;
}

/** Thrown when the quota is exceeded. The refresher records it in last_error. */
export class QuotaExceededError extends Error {
  constructor() {
    super("YouTube quota exceeded (resets at 00:00 PT)");
    this.name = "QuotaExceededError";
  }
}

/** A non-2xx answer from the YouTube API. Keeps the HTTP status so callers can tell the cases apart. */
export class YouTubeHttpError extends Error {
  readonly status: number;

  constructor(path: string, status: number, detail: string) {
    super(`YouTube ${path} failed: ${status} ${detail}`);
    this.name = "YouTubeHttpError";
    this.status = status;
  }
}

interface YouTubeApiError {
  error?: { message?: string };
}

/** Makes one YouTube API call: quota check → record the consumption → fetch. Throws on failure. */
async function callApi<T>(path: string, params: Record<string, string>, cost: number): Promise<T> {
  const quota = getQuota();
  if (!quota.canSpend(cost)) {
    throw new QuotaExceededError();
  }
  const { youtube_api_key } = getConfig();
  const url = new URL(`${API_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", youtube_api_key);

  // Quota is consumed by the call itself, so the cost is added whether or not the call succeeds.
  quota.spend(cost);
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = (await res.json()) as YouTubeApiError;
      if (body.error?.message) detail = body.error.message;
    } catch {
      /* Not JSON: keep statusText */
    }
    throw new YouTubeHttpError(path, res.status, detail);
  }
  return (await res.json()) as T;
}

interface PlaylistItemsResponse {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
}

/** Fetches the latest maxResults video IDs from one channel's uploads playlist (1 unit). */
async function fetchRecentVideoIds(channelId: string, maxResults = 10): Promise<string[]> {
  const data = await callApi<PlaylistItemsResponse>(
    "playlistItems",
    {
      part: "contentDetails",
      playlistId: uploadsPlaylistId(channelId),
      maxResults: String(maxResults),
    },
    QUOTA_COST.playlistItems_list,
  );
  return (data.items ?? [])
    .map((it) => it.contentDetails?.videoId)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}

interface VideoResource {
  id: string;
  snippet?: {
    title?: string;
    channelId?: string;
    publishedAt?: string;
    liveBroadcastContent?: "live" | "upcoming" | "none";
  };
  liveStreamingDetails?: {
    scheduledStartTime?: string;
    actualStartTime?: string;
    actualEndTime?: string;
  };
  status?: { uploadStatus?: string };
  contentDetails?: { duration?: string };
}

interface VideosResponse {
  items?: VideoResource[];
}

/** Fetches the given ids with videos.list in batches of up to 50 (1 unit per 50). */
async function fetchVideoResources(ids: string[]): Promise<VideoResource[]> {
  const out: VideoResource[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await callApi<VideosResponse>(
      "videos",
      {
        part: "snippet,liveStreamingDetails,status,contentDetails",
        id: batch.join(","),
        maxResults: "50",
      },
      QUOTA_COST.videos_list,
    );
    out.push(...(data.items ?? []));
  }
  return out;
}

/** Converts an ISO8601 duration (PT1H2M3S) to seconds. Returns undefined if it cannot be parsed. */
function parseIsoDuration(iso: string | undefined): number | undefined {
  if (!iso) return undefined;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return undefined;
  const [, d, h, min, s] = m;
  return (
    (d ? Number(d) * 86400 : 0) +
    (h ? Number(h) * 3600 : 0) +
    (min ? Number(min) * 60 : 0) +
    (s ? Number(s) : 0)
  );
}

interface ChannelMeta {
  id: string;
  /** Config note. Not used as a fallback when display_name has not been fetched; the UI prefers display_name. */
  name: string;
  /** Actual channel name fetched from the API (for UI display). NULL if not fetched yet. */
  display_name: string | null;
}

/** Converts a VideoResource into a VideoItem for a live or scheduled stream. */
function toLiveVideoItem(v: VideoResource, channelName: string): VideoItem {
  const status = v.snippet?.liveBroadcastContent === "live" ? "live" : "upcoming";
  return {
    id: v.id,
    title: v.snippet?.title ?? "",
    type: "stream",
    status,
    published_at: v.snippet?.publishedAt ?? "",
    start_scheduled: v.liveStreamingDetails?.scheduledStartTime,
    start_actual: v.liveStreamingDetails?.actualStartTime,
    thumbnail: youtubeThumbnail(v.id),
    // Channel icons are served only by GET /api/channels (not included here).
    channel: {
      id: v.snippet?.channelId ?? "",
      platform: "youtube",
      name: channelName,
    },
  };
}

/** Converts a VideoResource into an archive row (archive_videos). */
function toArchiveRow(v: VideoResource, channelId: string, fetchedAt: string): ArchiveVideoRow {
  const ls = v.liveStreamingDetails;
  return {
    id: v.id,
    channel_id: v.snippet?.channelId ?? channelId,
    title: v.snippet?.title ?? "",
    published_at: v.snippet?.publishedAt ?? null,
    start_actual: ls?.actualStartTime ?? null,
    end_actual: ls?.actualEndTime ?? null,
    duration: parseIsoDuration(v.contentDetails?.duration) ?? null,
    fetched_at: fetchedAt,
  };
}

/** Channels already reported as skipped, so the log gets one line per channel instead of one per cycle. */
const skippedChannels = new Set<string>();

export interface YouTubeFetchResult {
  live: VideoItem[];
  archive: ArchiveVideoRow[];
}

/**
 * Fetches the latest videos of the registered YouTube channels and returns them split into live/upcoming and archive.
 * Costs 1 playlistItems unit per channel, plus videos.list (1 unit per 50 videos, counted across all channels).
 */
export async function fetchYouTube(channels: ChannelMeta[]): Promise<YouTubeFetchResult> {
  // The UI shows the actual channel name (display_name). Empty if not fetched yet (NULL); the config note is never shown.
  const nameById = new Map(channels.map((c) => [c.id, c.display_name ?? ""]));
  const fetchedAt = new Date().toISOString();

  // 1. Collect each channel's latest video IDs.
  const allIds: string[] = [];
  for (const ch of channels) {
    try {
      allIds.push(...(await fetchRecentVideoIds(ch.id)));
    } catch (err) {
      // A 404 here means the channel has no uploads playlist: it has no public videos yet, the
      // configured ID is wrong, or the channel is gone. Skip just that channel, so one such entry
      // does not stop the refresh for everyone else. Any other failure (bad key, quota, outage) still aborts.
      if (!(err instanceof YouTubeHttpError) || err.status !== 404) throw err;
      if (!skippedChannels.has(ch.id)) {
        skippedChannels.add(ch.id);
        console.warn(`[youtube] skipping channel ${ch.id}: ${err.message}`);
      }
    }
  }
  if (allIds.length === 0) return { live: [], archive: [] };

  // 2. Batch-fetch the details.
  const resources = await fetchVideoResources(allIds);

  const live: VideoItem[] = [];
  const archive: ArchiveVideoRow[] = [];
  for (const v of resources) {
    const broadcast = v.snippet?.liveBroadcastContent;
    const channelId = v.snippet?.channelId ?? "";
    const channelName = nameById.get(channelId) ?? "";
    if (broadcast === "live" || broadcast === "upcoming") {
      live.push(toLiveVideoItem(v, channelName));
    } else if (broadcast === "none" && v.status?.uploadStatus === "processed") {
      // This also includes regular videos, but they are stored as archives (whether or not liveStreamingDetails is present).
      archive.push(toArchiveRow(v, channelId, fetchedAt));
    }
  }
  return { live, archive };
}

interface ChannelsListResponse {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string }; medium?: { url?: string } } };
  }>;
}

/**
 * Fetches YouTube channel icons (and optionally the actual channel names) and saves them to the channels table.
 * - Up to 50 ids are batched into one channels.list call, which costs 1 unit.
 * - When updateName=true, the API's title is saved to display_name (the UI display name).
 *   name, which is the config note, is left untouched. Both the icon backfill and the admin API call this with true.
 */
export async function fetchYouTubeChannelMeta(ids: string[], updateName: boolean): Promise<void> {
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const data = await callApi<ChannelsListResponse>(
      "channels",
      { part: "snippet", id: batch.join(","), maxResults: "50" },
      QUOTA_COST.channels_list,
    );
    for (const item of data.items ?? []) {
      const thumb = item.snippet?.thumbnails?.medium?.url ?? item.snippet?.thumbnails?.default?.url;
      // Instead of saving the external CDN URL as is, download the image to the server and save the local path
      // (to avoid the 429s caused by browsers hitting yt3.ggpht.com directly). thumbnail is not updated if the download fails.
      if (thumb) {
        const local = await downloadThumbnail(item.id, thumb);
        if (local) setChannelThumbnail(item.id, local);
      }
      if (updateName && item.snippet?.title) setChannelDisplayName(item.id, item.snippet.title);
      // Save the @handle (customUrl). The API returns it in the form "@handle", so the leading @ is stripped
      // to make the key match the handle (without @) that the frontend extracts from the oembed author_url.
      const customUrl = item.snippet?.customUrl;
      if (customUrl) setChannelHandle(item.id, customUrl.replace(/^@/, ""));
    }
  }
}

/** Icon backfill at startup: fetches only for YouTube channels whose thumbnail is NULL. */
export async function fillYouTubeThumbnails(): Promise<void> {
  const missing = getChannelsByPlatform("youtube").filter((c) => c.thumbnail === null);
  if (missing.length === 0) return;
  // While backfilling icons, also fill in display_name (the UI display name): same request, no extra quota cost.
  await fetchYouTubeChannelMeta(
    missing.map((c) => c.id),
    true,
  );
}
