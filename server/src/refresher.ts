import { getKv, setKv } from "./db.js";
import type {
  ExternalTarget,
  RefreshState,
  RefreshStatusResponse,
  RefreshTarget,
} from "./types.js";

/**
 * The fetch core plus in-flight sharing (the common foundation for polling and manual refresh).
 *
 * - Holds a RefreshState (status / last_updated / last_error / started_at) per target
 *   (live / archive). status / started_at / last_error are runtime state, so they can be
 *   volatile (resetting to idle on restart is the correct behavior).
 * - last_updated (the last fetch time), however, is persisted in the kv table. The live cache
 *   (cache.ts) is restored after a restart, so keeping its fetch time as well is consistent.
 *   This also fixes the display bug where the last-updated time of archives etc. was lost after a restart.
 * - Guard against rapid repeated / concurrent runs: if a refresh of the same target is in progress,
 *   no new job is started and the caller joins the in-progress Promise (no duplicate fetch).
 * - The actual fetch logic (the YouTube/Twitch integration) is injected from outside as a per-target
 *   fetcher (registerFetcher). An unregistered target records that fact in last_error and returns to idle.
 */

/** The actual fetch. On success it updates the cache / DB and resolves. Throwing counts as a failure. */
export type Fetcher = () => Promise<void>;

function freshState(): RefreshState {
  return { status: "idle", last_updated: null, last_error: null, started_at: null };
}

const TARGETS: RefreshTarget[] = ["live_youtube", "live_twitch", "archive"];

const states: Record<RefreshTarget, RefreshState> = {
  live_youtube: freshState(),
  live_twitch: freshState(),
  archive: freshState(),
};

/** Key under which last_updated is stored in kv. */
function lastUpdatedKey(target: RefreshTarget): string {
  return `last_updated:${target}`;
}

/** Whether last_updated has already been restored from kv, per target (done only once). */
const restored: Partial<Record<RefreshTarget, boolean>> = {};

/** Restores last_updated from kv on first access (status etc. stay volatile). */
function ensureRestored(target: RefreshTarget): void {
  if (restored[target]) return;
  restored[target] = true;
  const v = getKv(lastUpdatedKey(target));
  if (v !== null) states[target].last_updated = v;
}

/** Holds the in-progress job's Promise per target (for in-flight sharing). */
const inFlight: Partial<Record<RefreshTarget, Promise<void>>> = {};

/** Fetch implementation per target. Injected via registerFetcher. */
const fetchers: Partial<Record<RefreshTarget, Fetcher>> = {};

/** Registers the fetch implementation for a target (this is where the youtube/twitch integration is plugged in). */
export function registerFetcher(target: RefreshTarget, fetcher: Fetcher): void {
  fetchers[target] = fetcher;
}

/**
 * Hook called when a new job starts (the poller uses it to reschedule its periodic timer).
 * - Fires the moment a real fetch is newly started, whether from polling or a manual refresh.
 *   Not called when the caller joined an in-flight job and nothing new was started.
 * - This implements "when a fetch runs, time the next periodic poll from that point", so a
 *   manual refresh pushes back the poll that would follow it.
 */
let onJobStart: ((target: RefreshTarget) => void) | null = null;

/** Registers the new-job-start hook (injected by the poller). */
export function registerOnJobStart(fn: (target: RefreshTarget) => void): void {
  onJobStart = fn;
}

/** Returns the last fetch time (ISO8601) of the given target, or null if it has never been fetched. */
export function getLastUpdated(target: RefreshTarget): string | null {
  ensureRestored(target);
  return states[target].last_updated;
}

/**
 * Starts a refresh job for the given target (asynchronous, fire-and-forget).
 * - If already running, returns the in-progress job's Promise (joins it; no new job is started).
 * - If idle, starts a new job, marks the target running, and returns its Promise.
 * The caller (a route) is expected to return 202 without waiting for completion.
 */
export function start(target: RefreshTarget): Promise<void> {
  const running = inFlight[target];
  if (running) return running;

  const state = states[target];
  state.status = "running";
  state.started_at = new Date().toISOString();

  const job = runJob(target).finally(() => {
    delete inFlight[target];
  });
  inFlight[target] = job;

  // Call the hook only when a new job was started (not when joining an in-flight one).
  // In response, the poller reschedules its periodic timer so the next poll is timed from now.
  onJobStart?.(target);

  return job;
}

async function runJob(target: RefreshTarget): Promise<void> {
  const state = states[target];
  const fetcher = fetchers[target];
  try {
    if (!fetcher) {
      // A target with no registered fetch implementation is explicitly treated as a failure.
      throw new Error(`fetcher for "${target}" is not registered`);
    }
    await fetcher();
    state.last_updated = new Date().toISOString();
    state.last_error = null;
    setKv(lastUpdatedKey(target), state.last_updated);
  } catch (err) {
    state.last_error = err instanceof Error ? err.message : String(err);
    // This is fire-and-forget, so unless it is logged here, a failed background refresh goes unnoticed
    // (the state is stored in last_error, but seeing it requires calling /api/refresh/status).
    console.error(`[refresh] failed to refresh "${target}":`, state.last_error);
  } finally {
    state.status = "idle";
    state.started_at = null;
  }
}

/** Whether the target is currently being refreshed. */
export function isRunning(target: RefreshTarget): boolean {
  return states[target].status === "running";
}

/** Returns a snapshot (a copy) of the given target's state. */
export function getState(target: RefreshTarget): RefreshState {
  ensureRestored(target);
  return { ...states[target] };
}

/** Returns the later of two ISO8601 strings (null if both are null). They share a format, so a lexicographic comparison is enough. */
function laterIso(a: string | null, b: string | null): string | null {
  if (a === null) return b;
  if (b === null) return a;
  return a >= b ? a : b;
}

/**
 * Returns the aggregated state of the external "live" target (YouTube + Twitch).
 * - status: running if either one is running
 * - last_updated: the later one (the last time anything was fetched). Used for the frontend's "last fetched" time
 * - last_error: shown if either has one (joined if both do; this makes a YouTube quota overrun visible)
 */
export function getLiveState(): RefreshState {
  const yt = getState("live_youtube");
  const tw = getState("live_twitch");
  const errors = [yt.last_error, tw.last_error].filter((e): e is string => e !== null);
  return {
    status: yt.status === "running" || tw.status === "running" ? "running" : "idle",
    last_updated: laterIso(yt.last_updated, tw.last_updated),
    last_error: errors.length > 0 ? errors.join("; ") : null,
    started_at: yt.started_at ?? tw.started_at,
  };
}

/**
 * ETag seed for the external live target. Both values are concatenated so that the seed changes when either
 * YouTube's or Twitch's last_updated advances (the getLive() body merges the two, so an update to only one must not yield a 304).
 * null if neither has been fetched (no ETag is set, i.e. the latest data is always returned).
 */
export function getLiveEtagSeed(): string | null {
  const yt = getState("live_youtube").last_updated;
  const tw = getState("live_twitch").last_updated;
  if (yt === null && tw === null) return null;
  return `${yt ?? ""}|${tw ?? ""}`;
}

/** Returns the state of all targets for GET /api/refresh/status (live aggregates YouTube + Twitch). */
export function getStatus(): RefreshStatusResponse {
  return {
    live: getLiveState(),
    archive: getState("archive"),
  };
}

/** Normalizes an external target (live/archive/all) into an array of internal fetch targets. */
export function resolveTargets(target: ExternalTarget): RefreshTarget[] {
  if (target === "all") return [...TARGETS];
  if (target === "live") return ["live_youtube", "live_twitch"];
  return ["archive"];
}
