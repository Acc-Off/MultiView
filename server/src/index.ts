import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { logger } from "hono/logger";

import { ConfigError, loadConfig } from "./config.js";
import { closeDb, initDb } from "./db.js";
import { initQuota } from "./quota.js";
import { setConfig } from "./state.js";
import { syncChannels } from "./services/channels.js";
import { registerFetchers, fillMissingThumbnails } from "./services/fetchers.js";
import { ensureThumbnailsDir, thumbnailsDir, THUMBNAILS_URL_BASE } from "./services/thumbnails.js";
import * as poller from "./poller.js";

import { videosRoutes } from "./routes/videos.js";
import { channelsRoutes } from "./routes/channels.js";
import { quotaRoutes } from "./routes/quota.js";
import { configRoutes } from "./routes/config.js";
import { refreshRoutes, adminRefreshRoutes } from "./routes/refresh.js";

/**
 * Entry point of the MultiView backend.
 *
 * Startup sequence:
 *   1. Load config.yaml (abort startup on failure)
 *   2. Initialize SQLite (create data/ and the schema)
 *   3. Initialize quota / state (the config singleton)
 *   4. Sync the channels in config to the DB (UPSERT and delete)
 *   5. Register the API routes on Hono
 *   6. If polling_enabled=true, start the poller (initial fetch, then periodic runs)
 *   7. Start the HTTP server
 */

function buildApp(): Hono {
  const app = new Hono();
  app.use("*", logger());

  // Health check (for Docker / a fronting proxy; just returns 200)
  app.get("/api/health", (c) => c.json({ status: "ok" }));

  // Video lists, channels, quota, and public config
  app.route("/api/videos", videosRoutes);
  app.route("/api/channels", channelsRoutes);
  app.route("/api/quota", quotaRoutes);
  app.route("/api/config", configRoutes);

  // Manual refresh (conditionally public) and the admin API
  app.route("/api", refreshRoutes); // POST /api/refresh, GET /api/refresh/status
  app.route("/api/admin", adminRefreshRoutes); // POST /api/admin/refresh, /api/admin/channels/refresh

  // Return 404 for unmatched /api/* requests (placed first so the static serving / SPA fallback below does not swallow them).
  app.all("/api/*", (c) => c.json({ error: "not found" }, 404));

  // Static serving of channel icons (the images saved under data/thumbnails).
  // Browsers fetch them from here instead of hitting external CDNs (yt3.ggpht.com etc.) directly, which avoids 429s.
  // serveStatic's root only supports paths relative to cwd, so the absolute path is converted to one relative to cwd.
  ensureThumbnailsDir();
  const thumbsRoot = relative(process.cwd(), thumbnailsDir()).replace(/\\/g, "/");
  // File names include a content hash (cache busting), so a long-lived immutable cache is set.
  // When an icon changes, its file name (= URL) changes too, so the change shows up reliably regardless of the old max-age.
  app.use(`${THUMBNAILS_URL_BASE}/*`, async (c, next) => {
    await next();
    if (c.res.status === 200) {
      c.header("Cache-Control", "public, max-age=31536000, immutable");
    }
  });
  app.use(`${THUMBNAILS_URL_BASE}/*`, serveStatic({ root: thumbsRoot, rewriteRequestPath: (p) => p.replace(THUMBNAILS_URL_BASE, "") }));
  // A missing icon must be a 404. Without this the request would fall through to the SPA fallback below
  // and index.html would be returned (and cached) in place of the image.
  app.all(`${THUMBNAILS_URL_BASE}/*`, (c) => c.json({ error: "not found" }, 404));

  // Static file serving (the frontend's vite build output).
  // root is a path relative to cwd (serveStatic does not support absolute paths).
  // In production, cwd=/app and PUBLIC_DIR=./public (the Dockerfile copies frontend/dist there).
  const publicDir = process.env.PUBLIC_DIR ?? "./public";
  const indexHtml = resolve(process.cwd(), publicDir, "index.html");
  const hasFrontend = existsSync(indexHtml);

  if (hasFrontend) {
    // If a real file exists, serve it (assets/img, etc.).
    app.use("/*", serveStatic({ root: publicDir }));
    // SPA fallback: any GET the serveStatic above did not handle returns index.html
    // (for vue-router's history mode; /api/* is already handled above and never reaches here).
    app.get("/*", serveStatic({ root: publicDir, path: "index.html" }));
  } else {
    // Frontend not built (e.g. running the backend alone in development). Return a notice.
    app.get("/*", (c) =>
      c.text(
        "MultiView backend is running. Frontend is not deployed (PUBLIC_DIR=" +
          publicDir +
          "). In dev, run vite on a separate port. The API is under /api/.",
        200,
      ),
    );
  }

  return app;
}

function main(): void {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error("[startup] failed: " + err.message);
      process.exit(1);
    }
    throw err;
  }

  initDb();
  setConfig(config);
  initQuota(config);

  const sync = syncChannels(config);
  console.log(
    `[channels] sync complete: ${sync.upserted} upserted, ${sync.removed} removed`,
  );

  // Inject the real fetchers into the refresher / refresh routes (before poller.start).
  registerFetchers();

  // Icon backfill at startup: fetch only for channels whose thumbnail is NULL (no API calls for those already fetched).
  // A failure does not stop the app from starting (it can be retried on the next startup or via the admin API).
  void fillMissingThumbnails().catch((err) => {
    console.error("[channels] failed to backfill thumbnails:", err instanceof Error ? err.message : err);
  });

  const app = buildApp();

  poller.start(config);

  const port = Number(process.env.PORT) || 3000;
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[server] listening on http://localhost:${info.port}`);
    console.log(
      `[server] polling_enabled=${config.polling_enabled}, ` +
        `public_refresh_enabled=${config.public_refresh_enabled}`,
    );
    const publicDir = process.env.PUBLIC_DIR ?? "./public";
    const hasFrontend = existsSync(resolve(process.cwd(), publicDir, "index.html"));
    console.log(
      hasFrontend
        ? `[server] serving frontend from ${publicDir}`
        : `[server] no frontend at ${publicDir}; serving API only`,
    );
  });

  // Graceful shutdown: stop polling and close the DB
  const shutdown = (signal: string) => {
    console.log(`\n[server] received ${signal}; shutting down`);
    poller.stop();
    closeDb();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main();
