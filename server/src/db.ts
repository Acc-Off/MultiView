import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Database from "better-sqlite3";

export type Platform = "youtube" | "twitch";

export interface ChannelRow {
  id: string;
  platform: Platform;
  /** Display name from config.yaml (an admin note). Sync always overwrites it, treating config as the source of truth. */
  name: string;
  /** Actual channel name fetched from the API (YouTube title / Twitch display_name). Preferred for UI display. NULL if not fetched yet. */
  display_name: string | null;
  /** YouTube @handle (customUrl, fetched from the API). Used to resolve icons by handle for shared URLs. NULL if not fetched yet. */
  handle: string | null;
  thumbnail: string | null;
  /** Whether the channel is monitored for live streams (only meaningful for YouTube; always 1 for Twitch). */
  live: number;
  /** Whether videos (archives / clips) are fetched for the channel (only meaningful for YouTube; always 1 for Twitch). */
  video: number;
}

export interface ArchiveVideoRow {
  id: string;
  channel_id: string;
  title: string;
  published_at: string | null;
  start_actual: string | null;
  end_actual: string | null;
  duration: number | null;
  fetched_at: string;
}

/** Default path of the SQLite file. Can be overridden with the DB_PATH environment variable (for a Docker volume mount or development). */
export function dbPath(): string {
  return process.env.DB_PATH
    ? resolve(process.env.DB_PATH)
    : resolve(process.cwd(), "..", "data", "multiview.db");
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS channels (
  id           TEXT PRIMARY KEY,
  platform     TEXT NOT NULL,
  name         TEXT NOT NULL,
  display_name TEXT,
  handle       TEXT,
  thumbnail    TEXT,
  live         INTEGER NOT NULL DEFAULT 1,
  video        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS archive_videos (
  id              TEXT PRIMARY KEY,
  channel_id      TEXT NOT NULL,
  title           TEXT NOT NULL,
  published_at    TEXT,
  start_actual    TEXT,
  end_actual      TEXT,
  duration        INTEGER,
  fetched_at      TEXT NOT NULL,
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
CREATE INDEX IF NOT EXISTS idx_archive_channel ON archive_videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_archive_published ON archive_videos(published_at);

CREATE TABLE IF NOT EXISTS quota_usage (
  date  TEXT PRIMARY KEY,
  used  INTEGER NOT NULL
);

-- Generic key-value store for small pieces of state that must survive restarts.
-- Current uses: the live and scheduled stream caches (live_cache_youtube / live_cache_twitch)
-- and the last fetch time of each target (last_updated:live_youtube / last_updated:live_twitch /
-- last_updated:archive). All values are strings (JSON or ISO8601).
CREATE TABLE IF NOT EXISTS kv (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export type DB = Database.Database;

/**
 * Adds columns to an existing DB idempotently.
 * A channels table created by an older version has no live / video columns, so add them if missing
 * (DEFAULT 1 = existing rows stay fully fetched, as before).
 */
function migrate(db: DB): void {
  const cols = db.prepare<[], { name: string }>("PRAGMA table_info(channels)").all();
  const names = new Set(cols.map((c) => c.name));
  if (!names.has("live")) {
    db.exec("ALTER TABLE channels ADD COLUMN live INTEGER NOT NULL DEFAULT 1");
  }
  if (!names.has("video")) {
    db.exec("ALTER TABLE channels ADD COLUMN video INTEGER NOT NULL DEFAULT 1");
  }
  // Actual channel name (fetched from the API). DBs from older versions lack it, so add it if missing (nullable).
  if (!names.has("display_name")) {
    db.exec("ALTER TABLE channels ADD COLUMN display_name TEXT");
  }
  // YouTube @handle (customUrl, fetched from the API). Used to resolve icons by handle for shared URLs.
  if (!names.has("handle")) {
    db.exec("ALTER TABLE channels ADD COLUMN handle TEXT");
  }
}

let instance: DB | null = null;

/**
 * Initializes SQLite and returns the singleton.
 * - Creates the data/ directory if it does not exist.
 * - Uses WAL mode so that reads are not blocked while a write is in progress.
 * - Creates the schema (channels / archive_videos / quota_usage) idempotently.
 */
export function initDb(path: string = dbPath()): DB {
  if (instance) return instance;

  mkdirSync(dirname(path), { recursive: true });

  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  migrate(db);

  instance = db;
  return db;
}

/** Returns the initialized DB. Throws if called before initDb(). */
export function getDb(): DB {
  if (!instance) {
    throw new Error("DB is not initialized; call initDb() first.");
  }
  return instance;
}

/** Reads a value from the kv table. Returns null if the key is not set. */
export function getKv(key: string): string | null {
  const row = getDb()
    .prepare<[string], { value: string }>("SELECT value FROM kv WHERE key = ?")
    .get(key);
  return row ? row.value : null;
}

/** Saves a value to the kv table (UPSERT). */
export function setKv(key: string, value: string): void {
  getDb()
    .prepare("INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, value);
}

/** Closes the DB, for tests and graceful shutdown. */
export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
