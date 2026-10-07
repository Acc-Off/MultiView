import type { AppConfig } from "./config.js";
import type { RefreshTarget } from "./types.js";
import * as refresher from "./refresher.js";

/**
 * Background periodic polling (started only when polling_enabled=true).
 *
 * - Fetches live / archive at startup, then runs periodically at each target's interval.
 * - Actual fetches go through refresher.start(target), so even if polling and a manual
 *   refresh run at the same time, in-flight sharing prevents a duplicate fetch.
 * - "When a fetch runs, time the next periodic poll from that point": every time the
 *   refresher starts a new job (from polling or a manual refresh), that target's timer is
 *   rescheduled. A manual refresh therefore naturally pushes back the poll that would follow it.
 * - The initial fetch at startup is skipped if less than one interval has passed since the previous
 *   fetch (last_updated), so that a restart does not re-fetch needlessly within the interval. The live and
 *   scheduled stream cache (cache.ts) is restored from kv, so the display is preserved even when skipped.
 * - When polling_enabled=false, calling start() starts nothing (the cache stays empty).
 */

type PollerConfig = Pick<
  AppConfig,
  | "polling_enabled"
  | "poll_interval_live_youtube_minutes"
  | "poll_interval_live_twitch_minutes"
  | "poll_interval_archive_minutes"
>;

/** Polling targets (internal targets). Live is polled at separate intervals for YouTube and Twitch. */
const POLL_TARGETS: RefreshTarget[] = ["live_youtube", "live_twitch", "archive"];

const timers: Record<RefreshTarget, ReturnType<typeof setInterval> | null> = {
  live_youtube: null,
  live_twitch: null,
  archive: null,
};

/** Polling interval per target (milliseconds). Set in start(). */
const intervalMs: Record<RefreshTarget, number> = {
  live_youtube: 0,
  live_twitch: 0,
  archive: 0,
};

let started = false;

/** Reschedules the target's timer at its interval (stopping the existing one first, if any). */
function rescheduleTimer(target: RefreshTarget): void {
  const existing = timers[target];
  if (existing) clearInterval(existing);
  timers[target] = setInterval(() => {
    void refresher.start(target);
  }, intervalMs[target]);
}

/**
 * Whether the target should get an initial fetch at startup.
 * True if at least one interval has passed since the previous fetch (last_updated). True if never fetched.
 */
function shouldFetchOnStartup(target: RefreshTarget): boolean {
  const last = refresher.getLastUpdated(target);
  if (last === null) return true;
  const elapsed = Date.now() - new Date(last).getTime();
  // If last is invalid (NaN), err on the side of re-fetching.
  if (!Number.isFinite(elapsed)) return true;
  return elapsed >= intervalMs[target];
}

/**
 * Starts polling. Does nothing if polling_enabled=false.
 * Runs the initial fetch at startup (unless still within the interval), then repeats at the configured intervals.
 */
export function start(config: PollerConfig): void {
  if (!config.polling_enabled) {
    console.log("[poller] polling_enabled=false; periodic polling disabled");
    return;
  }
  if (started) {
    // Guard against starting twice.
    return;
  }
  started = true;

  intervalMs.live_youtube = config.poll_interval_live_youtube_minutes * 60_000;
  intervalMs.live_twitch = config.poll_interval_live_twitch_minutes * 60_000;
  intervalMs.archive = config.poll_interval_archive_minutes * 60_000;

  console.log(
    `[poller] started: live(youtube) every ${config.poll_interval_live_youtube_minutes}min, ` +
      `live(twitch) every ${config.poll_interval_live_twitch_minutes}min, ` +
      `archive every ${config.poll_interval_archive_minutes}min`,
  );

  // Every time a fetch runs (from polling or a manual refresh), reschedule that target's timer.
  refresher.registerOnJobStart((target) => {
    // Before start() or when polling_enabled=false, intervalMs is 0, so do nothing.
    if (!started || intervalMs[target] <= 0) return;
    rescheduleTimer(target);
  });

  // At startup: if still within the interval, skip the fetch and just let the timer wait for the next run.
  // When the initial fetch does run, the timer is set through the onJobStart hook above,
  // so the timer is set explicitly here only for the targets that were skipped.
  for (const target of POLL_TARGETS) {
    if (shouldFetchOnStartup(target)) {
      void refresher.start(target); // → onJobStart reschedules the timer
    } else {
      const last = refresher.getLastUpdated(target);
      console.log(
        `[poller] skip startup fetch for "${target}" (last_updated=${last}, within interval)`,
      );
      rescheduleTimer(target);
    }
  }
}

/** Stops the timers, for graceful shutdown and tests. */
export function stop(): void {
  for (const target of POLL_TARGETS) {
    const t = timers[target];
    if (t) {
      clearInterval(t);
      timers[target] = null;
    }
  }
  started = false;
}
