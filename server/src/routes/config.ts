import { Hono } from "hono";
import { getConfig } from "../state.js";
import type { PublicConfig } from "../types.js";

/**
 * GET /api/config/public … returns only the non-secret settings the frontend needs.
 * - public_refresh_enabled … whether to show the manual refresh button
 * - site_name              … service name chosen by the operator (for display)
 * - site_links             … arbitrary links at the bottom of the hamburger menu
 *
 * Secret values such as youtube_api_key / twitch_client_secret / admin_token must never be included.
 */
export const configRoutes = new Hono();

configRoutes.get("/public", (c) => {
  const cfg = getConfig();
  const body: PublicConfig = {
    public_refresh_enabled: cfg.public_refresh_enabled,
    site_name: cfg.site_name,
    site_links: cfg.site_links,
  };
  c.header("Cache-Control", "public, max-age=300");
  return c.json(body);
});
