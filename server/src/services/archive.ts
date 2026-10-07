import { getDb } from "../db.js";
import type { ArchiveVideoRow } from "../db.js";
import type { VideoItem } from "../types.js";

/**
 * Reading, converting, and persisting archive videos (the archive_videos table).
 * GET /api/videos/archive reads them from the DB (newest first), shapes them into VideoItem, and returns them.
 * Thumbnails are generated from a URL pattern. Channel icons are served only by GET /api/channels (not included here).
 *
 * Fetched results are persisted with an UPSERT by upsertArchiveVideos() (called by the YouTube integration).
 */

/** Builds the YouTube video thumbnail URL from the videoId (the thumbnails in the API response are not stored). */
export function youtubeThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

interface ArchiveJoinRow {
  id: string;
  title: string;
  published_at: string | null;
  start_actual: string | null;
  end_actual: string | null;
  duration: number | null;
  channel_id: string;
  channel_name: string;
}

/**
 * Returns archives as VideoItem[] (newest published_at first).
 * Archives are supported for YouTube only, so platform is fixed to "youtube".
 */
export function getArchiveVideos(limit = 200): VideoItem[] {
  const rows = getDb()
    .prepare<[number], ArchiveJoinRow>(
      `SELECT a.id, a.title, a.published_at, a.start_actual, a.end_actual, a.duration,
              a.channel_id, COALESCE(c.display_name, '') AS channel_name
       FROM archive_videos a
       JOIN channels c ON c.id = a.channel_id
       ORDER BY a.published_at DESC
       LIMIT ?`,
    )
    .all(limit);

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    type: "video" as const,
    status: "past" as const,
    published_at: r.published_at ?? "",
    start_actual: r.start_actual ?? undefined,
    end_actual: r.end_actual ?? undefined,
    duration: r.duration ?? undefined,
    thumbnail: youtubeThumbnail(r.id),
    channel: {
      id: r.channel_id,
      platform: "youtube" as const,
      name: r.channel_name,
    },
  }));
}

/**
 * Persists archive videos into archive_videos with an UPSERT (existing ids are updated, never duplicated).
 * fetched_at is overwritten with the time of the call (when this app fetched and saved the row).
 */
export function upsertArchiveVideos(rows: ArchiveVideoRow[]): number {
  if (rows.length === 0) return 0;
  const db = getDb();
  const upsert = db.prepare(
    `INSERT INTO archive_videos
       (id, channel_id, title, published_at, start_actual, end_actual, duration, fetched_at)
     VALUES (@id, @channel_id, @title, @published_at, @start_actual, @end_actual, @duration, @fetched_at)
     ON CONFLICT(id) DO UPDATE SET
       title        = excluded.title,
       published_at = excluded.published_at,
       start_actual = excluded.start_actual,
       end_actual   = excluded.end_actual,
       duration     = excluded.duration,
       fetched_at   = excluded.fetched_at`,
  );
  const run = db.transaction((items: ArchiveVideoRow[]) => {
    for (const r of items) upsert.run(r);
  });
  run(rows);
  return rows.length;
}
