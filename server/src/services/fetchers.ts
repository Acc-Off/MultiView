import { setYouTubeLive, setTwitchLive } from "../cache.js";
import {
  getChannelsByPlatform,
  getLiveChannelsByPlatform,
  getVideoChannelsByPlatform,
} from "./channels.js";
import { upsertArchiveVideos } from "./archive.js";
import {
  fetchYouTube,
  fetchYouTubeChannelMeta,
  fillYouTubeThumbnails,
} from "./youtube.js";
import {
  fetchTwitchLive,
  fetchTwitchUserMeta,
  fillTwitchThumbnails,
} from "./twitch.js";
import { registerFetcher } from "../refresher.js";
import { registerChannelRefresher } from "../routes/refresh.js";

/**
 * Injects the real fetch implementations into the refresher / refresh routes.
 *
 * - live_youtube fetcher: puts YouTube live and scheduled streams into the YouTube part of the cache.
 * - live_twitch  fetcher: puts Twitch live streams into the Twitch part of the cache.
 * - archive fetcher: persists YouTube archives into archive_videos with an UPSERT.
 * - channel refresher: forces a re-fetch of all channels' icons and names (admin API).
 *
 * Because YouTube and Twitch are separate fetchers (= separate targets and intervals), live_twitch
 * keeps polling at its own interval even when YouTube throws on a quota overrun. The YouTube part of
 * the cache keeps its previous value, so the display (the merge in getLive) is preserved too.
 *
 * All of them are registered once by registerFetchers() during startup in index.ts (before poller.start).
 */

/**
 * live (YouTube) fetch: fetches YouTube live/upcoming and updates the YouTube part of the cache.
 * Only channels with live=true are queried (to save quota). When the quota is exceeded, fetchYouTube
 * throws and setYouTubeLive is never called, so the previous YouTube result is kept.
 */
async function refreshLiveYouTube(): Promise<void> {
  const yt = getLiveChannelsByPlatform("youtube");
  const live = yt.length > 0 ? (await fetchYouTube(yt)).live : [];
  setYouTubeLive(live);
}

/**
 * live (Twitch) fetch: fetches Twitch live streams and updates the Twitch part of the cache.
 * Twitch has no quota system, so all channels are covered.
 */
async function refreshLiveTwitch(): Promise<void> {
  const tw = getChannelsByPlatform("twitch");
  const live = await fetchTwitchLive(tw);
  setTwitchLive(live);
}

/**
 * archive fetch: fetches YouTube archives and UPSERTs them into the DB.
 * Only channels with video=true are queried (only the ones shown in the video list).
 */
async function refreshArchive(): Promise<void> {
  const yt = getVideoChannelsByPlatform("youtube");
  if (yt.length === 0) return;
  const { archive } = await fetchYouTube(yt);
  upsertArchiveVideos(archive);
}

/**
 * Runs every task even when an earlier one fails, then reports the failures together.
 * YouTube and Twitch are independent, so a problem with one (an invalid key, an exhausted quota)
 * must not keep the other from being updated.
 */
async function runAll(tasks: Array<() => Promise<void>>): Promise<void> {
  const errors: string[] = [];
  for (const task of tasks) {
    try {
      await task();
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (errors.length > 0) throw new Error(errors.join("; "));
}

/** Forces a re-fetch of all channels' icons and names (admin API: POST /api/admin/channels/refresh). */
async function refreshChannels(): Promise<void> {
  const yt = getChannelsByPlatform("youtube");
  const tw = getChannelsByPlatform("twitch");
  await runAll([
    async () => {
      if (yt.length > 0) {
        await fetchYouTubeChannelMeta(
          yt.map((c) => c.id),
          true,
        );
      }
    },
    async () => {
      if (tw.length > 0) {
        await fetchTwitchUserMeta(
          tw.map((c) => c.id),
          true,
        );
      }
    },
  ]);
}

/**
 * Icon backfill at startup: fetches only for channels whose thumbnail is NULL (no API calls for those already fetched).
 * A channel newly added to config has a NULL thumbnail, so it is fetched here exactly once.
 */
export async function fillMissingThumbnails(): Promise<void> {
  await runAll([fillYouTubeThumbnails, fillTwitchThumbnails]);
}

/** Registers the real fetchers with the refresher / refresh routes. */
export function registerFetchers(): void {
  registerFetcher("live_youtube", refreshLiveYouTube);
  registerFetcher("live_twitch", refreshLiveTwitch);
  registerFetcher("archive", refreshArchive);
  registerChannelRefresher(refreshChannels);
}
