import { timingSafeEqual } from "node:crypto";
import { createMiddleware } from "hono/factory";
import { getConfig } from "../state.js";

/** Extracts the token from the request's Authorization: Bearer header (null if absent). */
export function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer\s+(.+)$/i.exec(header.trim());
  return m ? m[1].trim() : null;
}

/** Whether the given token matches admin_token. Compared in constant time so the response time does not leak how much of it matched. */
export function isAdminToken(token: string | null): boolean {
  if (!token) return false;
  const given = Buffer.from(token);
  const expected = Buffer.from(getConfig().admin_token);
  // timingSafeEqual requires equal lengths; a different length is a mismatch anyway.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Middleware for the admin API (admin_token is always required).
 * - No token → 401
 * - Token mismatch → 403
 * Applied to `POST /api/admin/*`.
 */
export const requireAdmin = createMiddleware(async (c, next) => {
  const token = extractBearer(c.req.header("Authorization"));
  if (token === null) {
    return c.json({ error: "authentication required (Authorization: Bearer <admin_token>)" }, 401);
  }
  if (!isAdminToken(token)) {
    return c.json({ error: "token mismatch" }, 403);
  }
  await next();
});

/**
 * Gate for POST /api/refresh.
 * - public_refresh_enabled=true → allowed for anyone (no token needed)
 * - public_refresh_enabled=false → admin_token required. A mismatched or missing token gets 403
 *   (when manual refresh is not public, regular users get 403 and the frontend hides the button)
 */
export const refreshGate = createMiddleware(async (c, next) => {
  const { public_refresh_enabled } = getConfig();
  if (public_refresh_enabled) {
    await next();
    return;
  }
  const token = extractBearer(c.req.header("Authorization"));
  if (!isAdminToken(token)) {
    return c.json(
      { error: "manual refresh is restricted to admins (public_refresh_enabled=false)" },
      403,
    );
  }
  await next();
});
