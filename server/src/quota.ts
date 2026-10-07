import type { AppConfig } from "./config.js";
import { getDb } from "./db.js";
import type { QuotaState } from "./types.js";

/**
 * Approximate counter for the YouTube API quota, plus enforcement of the limit.
 *
 * - Responses do not report actual consumption, so it is accumulated from the per-call costs defined here (an estimate).
 * - The running total for the day is persisted in the quota_usage table (UPSERT). Even across restarts
 *   or a crash loop, the day's consumption does not reset to 0, so the limit is reliably enforced.
 * - Dates are in Pacific Time (PT, the basis for YouTube's reset). At 00:00 PT it naturally rolls over to a new date row.
 * - Twitch has no quota system, so it is out of scope (YouTube only).
 */

/** Approximate cost per YouTube API call. */
export const QUOTA_COST = {
  playlistItems_list: 1, // 1 unit per call
  videos_list: 1, // 1 unit per call (still 1 unit when batching up to 50 ids)
  channels_list: 1, // 1 unit per call (still 1 unit when batching up to 50 ids)
} as const;

/** Cost of the cheapest call. Once not even this fits under the threshold, every YouTube call is refused. */
const MIN_CALL_COST = Math.min(...Object.values(QUOTA_COST));

/** Returns the current Pacific Time date as "YYYY-MM-DD", independent of the server's time zone. */
export function ptDate(now: Date = new Date()): string {
  // en-CA formats dates as YYYY-MM-DD, which is convenient for getting the PT calendar date.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export class Quota {
  private limit: number;
  private margin: number;
  private lastCallAt: string | null = null;

  constructor(config: Pick<AppConfig, "youtube_quota_limit" | "quota_safety_margin">) {
    this.limit = config.youtube_quota_limit;
    this.margin = config.quota_safety_margin;
  }

  /** Reads the day's used value from quota_usage (0 if there is no row). */
  private readUsed(date: string): number {
    const row = getDb()
      .prepare<[string], { used: number }>("SELECT used FROM quota_usage WHERE date = ?")
      .get(date);
    return row?.used ?? 0;
  }

  /** Threshold after applying the safety margin to the limit. Consumption beyond this is blocked. */
  private threshold(): number {
    return this.limit * this.margin;
  }

  /**
   * Whether spending cost units would still stay within the safety margin.
   * Meant to be checked right before calling the API; if false, the call should be skipped.
   */
  canSpend(cost: number, now: Date = new Date()): boolean {
    const date = ptDate(now);
    const used = this.readUsed(date);
    return used + cost <= this.threshold();
  }

  /**
   * Records that cost units were actually spent (added at the time of the call, whether the
   * API call succeeds or fails, because quota is consumed by the call itself).
   * UPSERTs the day's row with used += cost.
   */
  spend(cost: number, now: Date = new Date()): void {
    const date = ptDate(now);
    getDb()
      .prepare(
        `INSERT INTO quota_usage (date, used) VALUES (?, ?)
         ON CONFLICT(date) DO UPDATE SET used = used + excluded.used`,
      )
      .run(date, cost);
    this.lastCallAt = now.toISOString();
  }

  /**
   * Returns the current state for monitoring.
   * exceeded is true while YouTube calls are being refused, i.e. when not even the cheapest call
   * passes canSpend(). (used never goes past the threshold, so comparing used with it would never be true.)
   */
  getState(now: Date = new Date()): QuotaState {
    const date = ptDate(now);
    const used = this.readUsed(date);
    return {
      date,
      used,
      limit: this.limit,
      last_call_at: this.lastCallAt,
      exceeded: used + MIN_CALL_COST > this.threshold(),
    };
  }
}

let instance: Quota | null = null;

/** Initializes the Quota singleton (must be called after the DB is initialized). */
export function initQuota(
  config: Pick<AppConfig, "youtube_quota_limit" | "quota_safety_margin">,
): Quota {
  instance = new Quota(config);
  return instance;
}

export function getQuota(): Quota {
  if (!instance) {
    throw new Error("Quota is not initialized; call initQuota() first.");
  }
  return instance;
}
