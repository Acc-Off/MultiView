import type { AppConfig } from "../config.js";
import { getDb } from "../db.js";
import type { ChannelRow, Platform } from "../db.js";

/**
 * Syncing channels to the DB and reading them.
 *
 * At startup, the channels in config.yaml are applied to the channels table in SQLite:
 * - Channels present in config are UPSERTed (name / platform are updated, keyed by id).
 *   thumbnail is not overwritten by the UPSERT (icons are fetched later, and only when it is NULL).
 * - Channels removed from config are deleted, and their archive_videos rows are cleaned up too.
 *
 * Only metadata (id/name/platform) is synced here. Fetching icons (thumbnail) calls the
 * YouTube/Twitch APIs, so it is done separately (the startup backfill and the admin API).
 */

interface ConfigChannel {
  id: string;
  name: string;
  platform: Platform;
  live: number;
  video: number;
}

function flattenConfigChannels(config: AppConfig): ConfigChannel[] {
  return [
    ...config.channels.youtube.map((c) => ({
      id: c.id,
      name: c.name,
      platform: "youtube" as const,
      live: c.live ? 1 : 0,
      video: c.video ? 1 : 0,
    })),
    // Twitch has no such flags (its quota is effectively unlimited). Both live and video are always fetched (1).
    ...config.channels.twitch.map((c) => ({
      id: c.id,
      name: c.name,
      platform: "twitch" as const,
      live: 1,
      video: 1,
    })),
  ];
}

export interface SyncResult {
  upserted: number;
  removed: number;
}

/**
 * Syncs the channels in config to the DB, all in a single transaction.
 * @returns the number of rows UPSERTed and the number removed
 */
export function syncChannels(config: AppConfig): SyncResult {
  const db = getDb();
  const desired = flattenConfigChannels(config);
  const desiredIds = new Set(desired.map((c) => c.id));

  // thumbnail / display_name are deliberately not overwritten (existing values are kept; the API fills them in later, only when NULL).
  //   - name (the config note) is always overwritten, treating config as the source of truth.
  //   - display_name (the actual channel name from the API, for UI display) is filled in by the API backfill, so it is left alone here.
  // live / video are always overwritten, treating config as the source of truth (so that flag changes take effect).
  const upsert = db.prepare(
    `INSERT INTO channels (id, platform, name, display_name, thumbnail, live, video)
     VALUES (@id, @platform, @name, NULL, NULL, @live, @video)
     ON CONFLICT(id) DO UPDATE SET
       platform = excluded.platform,
       name     = excluded.name,
       live     = excluded.live,
       video    = excluded.video`,
  );

  const selectAllIds = db.prepare<[], { id: string }>("SELECT id FROM channels");
  const deleteChannel = db.prepare<[string]>("DELETE FROM channels WHERE id = ?");
  const deleteArchives = db.prepare<[string]>("DELETE FROM archive_videos WHERE channel_id = ?");

  const run = db.transaction(() => {
    for (const ch of desired) {
      upsert.run(ch);
    }
    let removed = 0;
    for (const { id } of selectAllIds.all()) {
      if (!desiredIds.has(id)) {
        deleteArchives.run(id);
        deleteChannel.run(id);
        removed += 1;
      }
    }
    return removed;
  });

  const removed = run();
  return { upserted: desired.length, removed };
}

/** Returns all channels. */
export function getAllChannels(): ChannelRow[] {
  return getDb()
    .prepare<[], ChannelRow>("SELECT id, platform, name, display_name, handle, thumbnail, live, video FROM channels")
    .all();
}

/** Returns the channels whose thumbnail has not been fetched yet (NULL), i.e. the icon backfill targets. */
export function getChannelsWithoutThumbnail(): ChannelRow[] {
  return getDb()
    .prepare<[], ChannelRow>(
      "SELECT id, platform, name, display_name, handle, thumbnail, live, video FROM channels WHERE thumbnail IS NULL",
    )
    .all();
}

/** Returns the channels of the given platform. */
export function getChannelsByPlatform(platform: Platform): ChannelRow[] {
  return getDb()
    .prepare<[Platform], ChannelRow>(
      "SELECT id, platform, name, display_name, handle, thumbnail, live, video FROM channels WHERE platform = ?",
    )
    .all(platform);
}

/** Returns the channels monitored for live streams (live=1) on the given platform. */
export function getLiveChannelsByPlatform(platform: Platform): ChannelRow[] {
  return getDb()
    .prepare<[Platform], ChannelRow>(
      "SELECT id, platform, name, display_name, handle, thumbnail, live, video FROM channels WHERE platform = ? AND live = 1",
    )
    .all(platform);
}

/** Returns the channels whose videos are fetched (video=1) on the given platform. */
export function getVideoChannelsByPlatform(platform: Platform): ChannelRow[] {
  return getDb()
    .prepare<[Platform], ChannelRow>(
      "SELECT id, platform, name, display_name, handle, thumbnail, live, video FROM channels WHERE platform = ? AND video = 1",
    )
    .all(platform);
}

/**
 * Saves a channel's icon URL (writes back the one fetched from the API).
 * Called from the startup icon backfill and the admin API's forced re-fetch.
 */
export function setChannelThumbnail(id: string, thumbnail: string): void {
  getDb().prepare<[string, string]>("UPDATE channels SET thumbnail = ? WHERE id = ?").run(thumbnail, id);
}

/**
 * Saves the @handle (customUrl) fetched from the API (used to resolve icons by handle for shared URLs).
 * Called from the icon backfill and the admin API's forced re-fetch.
 */
export function setChannelHandle(id: string, handle: string): void {
  getDb().prepare<[string, string]>("UPDATE channels SET handle = ? WHERE id = ?").run(handle, id);
}

/**
 * Saves the actual channel name fetched from the API to display_name (for UI display).
 * name, which is the config note, is left untouched. Called from the icon backfill and the admin API's forced re-fetch.
 */
export function setChannelDisplayName(id: string, displayName: string): void {
  getDb()
    .prepare<[string, string]>("UPDATE channels SET display_name = ? WHERE id = ?")
    .run(displayName, id);
}
