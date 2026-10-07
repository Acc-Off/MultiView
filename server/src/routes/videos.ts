import { Hono } from "hono";
import type { Context } from "hono";
import { getLive } from "../cache.js";
import { getArchiveVideos } from "../services/archive.js";
import * as refresher from "../refresher.js";
import type { VideoItem, VideosResponse } from "../types.js";

/**
 * Fills in available_at, the reference time for display (Holodex-compatible).
 * The frontend's date/time display, sorting, etc. rely on it, so it is always added when shaping the response.
 * Priority: start_actual (actually started) > start_scheduled (scheduled) > published_at.
 */
function withAvailableAt(items: VideoItem[]): VideoItem[] {
  return items.map((v) => ({
    ...v,
    available_at: v.start_actual ?? v.start_scheduled ?? v.published_at,
  }));
}

/**
 * Decides whether a conditional request (ETag) can be answered with 304.
 *
 * The data only changes when a fetch succeeds, i.e. when last_updated is updated, so using
 * last_updated as the ETag gives "200 if updated, 304 if not".
 * - notModified is true when a 304 can be returned (the caller ends the response there).
 * - When last_updated is null (not fetched yet), no ETag is set, i.e. the latest data is always
 *   returned (so that clients reliably pick it up right after the fetch).
 *
 * Cache-Control is no-cache (the cached copy is kept but revalidated with the server every time), which
 * gives both a lightweight 304 when the body is unchanged and an always-current last-updated time.
 */
function handleConditional(c: Context, key: string, seed: string | null): { notModified: boolean } {
  c.header("Cache-Control", "no-cache");
  if (seed === null) {
    return { notModified: false };
  }
  const etag = `"${key}-${seed}"`;
  c.header("ETag", etag);
  const inm = c.req.header("If-None-Match");
  return { notModified: inm === etag };
}

/**
 * GET /api/videos/live    … served from the in-memory cache (items:[], last_updated:null if empty)
 * GET /api/videos/archive … served from the archive_videos table
 * Neither calls an external API (cache updates are handled by polling / manual refresh).
 * The response includes the target's last_updated, which the frontend uses for its "last fetched" time.
 * With the ETag (derived from last_updated), an unchanged response returns 304, skipping the SELECT, shaping, and transfer.
 */
export const videosRoutes = new Hono();

videosRoutes.get("/live", (c) => {
  // live aggregates YouTube + Twitch. The ETag is checked against a seed that concatenates both last_updated values
  // (so that an update to only one of them does not result in a 304). The displayed last_updated uses the later one.
  const { notModified } = handleConditional(c, "live", refresher.getLiveEtagSeed());
  if (notModified) return c.body(null, 304);

  const body: VideosResponse = {
    items: withAvailableAt(getLive() ?? []),
    last_updated: refresher.getLiveState().last_updated,
  };
  return c.json(body);
});

videosRoutes.get("/archive", (c) => {
  const { notModified } = handleConditional(c, "archive", refresher.getState("archive").last_updated);
  // If nothing has changed, return 304 without even touching the DB (avoids the SELECT load at large scale).
  if (notModified) return c.body(null, 304);

  const body: VideosResponse = {
    items: withAvailableAt(getArchiveVideos()),
    last_updated: refresher.getState("archive").last_updated,
  };
  return c.json(body);
});
