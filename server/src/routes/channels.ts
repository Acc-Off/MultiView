import { Hono } from "hono";
import { getAllChannels } from "../services/channels.js";

/**
 * GET /api/channels … the list of registered channels (from the channels table in the DB).
 * thumbnail is returned as an empty string if it has not been fetched yet (NULL).
 */
export const channelsRoutes = new Hono();

channelsRoutes.get("/", (c) => {
  const channels = getAllChannels().map((ch) => ({
    id: ch.id,
    platform: ch.platform,
    // The UI shows the actual channel name (display_name). Empty if not fetched yet (NULL); the config note "name" is never shown.
    name: ch.display_name ?? "",
    // @handle (YouTube customUrl). Used to resolve icons by handle for shared URLs. Empty if not fetched yet.
    handle: ch.handle ?? "",
    thumbnail: ch.thumbnail ?? "",
    // Fetch-target flags (display only). config.yaml is the source of truth; the frontend never changes them.
    // Twitch is conceptually always a target for both (fixed to 1 at sync time).
    live: !!ch.live,
    video: !!ch.video,
  }));
  c.header("Cache-Control", "public, max-age=300");
  return c.json({ channels });
});
