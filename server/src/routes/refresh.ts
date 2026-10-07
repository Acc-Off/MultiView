import { Hono } from "hono";
import { requireAdmin, refreshGate } from "../middleware/auth.js";
import * as refresher from "../refresher.js";

/**
 * Manual refresh (asynchronous, fire-and-forget) and retrieval of the refresh status.
 *
 * - POST /api/refresh                  … manual refresh from the frontend. When public_refresh_enabled=false,
 *                                        an admin token is required (refreshGate). ?target=live|archive|all
 * - POST /api/admin/refresh            … admin API. Always admin only (requireAdmin)
 * - POST /api/admin/channels/refresh   … forces a re-fetch of channel icons and names (admin only)
 * - GET  /api/refresh/status           … status/last_updated/last_error of each target
 *
 * Every refresh returns 202 immediately without waiting for the fetch to finish. The frontend polls
 * status to detect completion. If the same target is already in progress, the refresher joins it (no duplicate fetch).
 */

/** Forces a re-fetch of channel icons and names. Injected via registerChannelRefresher. */
type ChannelRefresher = () => Promise<void>;
let channelRefresher: ChannelRefresher | null = null;

export function registerChannelRefresher(fn: ChannelRefresher): void {
  channelRefresher = fn;
}

function parseTarget(raw: string | undefined): "live" | "archive" | "all" | null {
  const t = raw ?? "all";
  return t === "live" || t === "archive" || t === "all" ? t : null;
}

/** Starts the refresh jobs for the given target (including all). Does not wait for completion. */
function kickoff(target: "live" | "archive" | "all"): void {
  for (const t of refresher.resolveTargets(target)) {
    void refresher.start(t);
  }
}

// --- Public (conditional) manual refresh ---
export const refreshRoutes = new Hono();

refreshRoutes.post("/refresh", refreshGate, (c) => {
  const target = parseTarget(c.req.query("target"));
  if (!target) {
    return c.json({ error: "target must be one of live | archive | all" }, 400);
  }
  c.header("Cache-Control", "no-store");
  kickoff(target);
  return c.json({ accepted: true, target }, 202);
});

refreshRoutes.get("/refresh/status", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(refresher.getStatus());
});

// --- Admin API (always admin only) ---
export const adminRefreshRoutes = new Hono();

adminRefreshRoutes.use("/*", requireAdmin);

adminRefreshRoutes.post("/refresh", (c) => {
  const target = parseTarget(c.req.query("target"));
  if (!target) {
    return c.json({ error: "target must be one of live | archive | all" }, 400);
  }
  c.header("Cache-Control", "no-store");
  kickoff(target);
  return c.json({ accepted: true, target }, 202);
});

adminRefreshRoutes.post("/channels/refresh", async (c) => {
  c.header("Cache-Control", "no-store");
  if (!channelRefresher) {
    // Not available unless one was registered via registerChannelRefresher.
    return c.json({ error: "channel refresh is not available" }, 503);
  }
  try {
    await channelRefresher();
    return c.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[admin] failed to refresh channels:", message);
    return c.json({ error: message }, 500);
  }
});
