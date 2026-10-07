import { Hono } from "hono";
import { getQuota } from "../quota.js";

/**
 * GET /api/quota … returns the approximate YouTube quota usage (for monitoring).
 * Public by default (if it ever needs to be hidden, it can be put behind admin_token in the future).
 */
export const quotaRoutes = new Hono();

quotaRoutes.get("/", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json(getQuota().getState());
});
