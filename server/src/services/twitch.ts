import { getConfig } from "../state.js";
import { getChannelsByPlatform, setChannelDisplayName, setChannelThumbnail } from "./channels.js";
import { downloadThumbnail } from "./thumbnails.js";
import type { VideoItem } from "../types.js";

/**
 * Twitch Helix API integration.
 *
 * - Obtains an App Access Token via the client credentials flow and keeps it in memory
 *   (not stored in the DB, because obtaining it consumes no quota and it can be reissued from client_secret).
 *   On a 401, the token is discarded and obtained again for a retry.
 * - GET /helix/streams fetches all channels in a single request (up to 100).
 * - GET /helix/users fills in profile images (icons), only when a channel is first registered.
 * - Twitch supports live only (archives are YouTube only). It has no quota system, so it is not tracked by quota.
 */

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const HELIX_BASE = "https://api.twitch.tv/helix";

interface TokenState {
  accessToken: string;
  // Expiry time (ms epoch). Treated as expired a little early to leave a margin.
  expiresAt: number;
}

let token: TokenState | null = null;

interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

/** Returns an App Access Token, obtaining it (or reissuing it if necessary). */
async function getAccessToken(force = false): Promise<string> {
  if (!force && token && Date.now() < token.expiresAt) {
    return token.accessToken;
  }
  const { twitch_client_id, twitch_client_secret } = getConfig();
  const url = new URL(TOKEN_URL);
  url.searchParams.set("client_id", twitch_client_id);
  url.searchParams.set("client_secret", twitch_client_secret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    throw new Error(`Twitch token request failed: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as TokenResponse;
  token = {
    accessToken: data.access_token,
    // Subtract a 60-second safety margin.
    expiresAt: Date.now() + Math.max(0, data.expires_in - 60) * 1000,
  };
  return token.accessToken;
}

/** Calls the Helix API. On a 401, reissues the token and retries exactly once. */
async function callHelix<T>(path: string, params: URLSearchParams): Promise<T> {
  const { twitch_client_id } = getConfig();
  const url = `${HELIX_BASE}/${path}?${params.toString()}`;

  const doFetch = async (accessToken: string): Promise<Response> =>
    fetch(url, {
      headers: {
        "Client-Id": twitch_client_id,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let res = await doFetch(await getAccessToken());
  if (res.status === 401) {
    // The token may have expired. Force a reissue and retry once.
    res = await doFetch(await getAccessToken(true));
  }
  if (!res.ok) {
    throw new Error(`Twitch ${path} failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

interface StreamsResponse {
  data?: Array<{
    user_login: string;
    user_name: string;
    title: string;
    started_at: string;
    thumbnail_url: string;
  }>;
}

interface ChannelMeta {
  id: string; // Twitch login name
  /** Config note. The UI prefers display_name, and this is not used as a fallback. */
  name: string;
  /** Actual channel name fetched from the API (for UI display). NULL if not fetched yet. */
  display_name: string | null;
}

/** Replaces the {width}/{height} placeholders in a Twitch thumbnail URL with actual dimensions. */
function resolveThumbnail(url: string, width = 640, height = 360): string {
  return url.replace("{width}", String(width)).replace("{height}", String(height));
}

/**
 * Fetches the live streams of the registered Twitch channels and returns them as VideoItem[].
 * /helix/streams accepts up to 100 user_login values in a single request.
 */
export async function fetchTwitchLive(channels: ChannelMeta[]): Promise<VideoItem[]> {
  if (channels.length === 0) return [];
  // The UI shows the actual channel name (display_name). If not fetched yet, it falls back below to user_name from streams.
  const nameByLogin = new Map(channels.map((c) => [c.id.toLowerCase(), c.display_name]));

  const items: VideoItem[] = [];
  // In batches of 100 (not exceeded in practice, but split just in case).
  for (let i = 0; i < channels.length; i += 100) {
    const batch = channels.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const ch of batch) params.append("user_login", ch.id);
    const data = await callHelix<StreamsResponse>("streams", params);
    for (const s of data.data ?? []) {
      const login = s.user_login.toLowerCase();
      items.push({
        id: login, // Twitch has one live stream per channel, so the login name is used as the id
        title: s.title,
        type: "stream",
        status: "live",
        published_at: s.started_at,
        start_actual: s.started_at,
        thumbnail: resolveThumbnail(s.thumbnail_url),
        // Channel icons are served only by GET /api/channels (not included here).
        channel: {
          id: login,
          platform: "twitch",
          name: nameByLogin.get(login) ?? s.user_name,
        },
      });
    }
  }
  return items;
}

interface UsersResponse {
  data?: Array<{
    login: string;
    display_name: string;
    profile_image_url: string;
  }>;
}

/**
 * Fetches Twitch channel icons (and optionally the actual channel names) and saves them to the channels table.
 * - Up to 100 logins per request.
 * - When updateName=true, the API's display_name is saved to channels.display_name (the UI display name).
 *   name, which is the config note, is left untouched. Both the icon backfill and the admin API call this with true.
 */
export async function fetchTwitchUserMeta(logins: string[], updateName: boolean): Promise<void> {
  for (let i = 0; i < logins.length; i += 100) {
    const batch = logins.slice(i, i + 100);
    const params = new URLSearchParams();
    for (const login of batch) params.append("login", login);
    const data = await callHelix<UsersResponse>("users", params);
    for (const u of data.data ?? []) {
      // As with YouTube, download the image to the server and save the local path instead of the external CDN URL
      // (so browsers never hit the external CDN directly and everything is served from this server). Not updated if the download fails.
      if (u.profile_image_url) {
        const local = await downloadThumbnail(u.login, u.profile_image_url);
        if (local) setChannelThumbnail(u.login, local);
      }
      if (updateName && u.display_name) setChannelDisplayName(u.login, u.display_name);
    }
  }
}

/** Icon backfill at startup: fetches only for Twitch channels whose thumbnail is NULL. */
export async function fillTwitchThumbnails(): Promise<void> {
  const missing = getChannelsByPlatform("twitch").filter((c) => c.thumbnail === null);
  if (missing.length === 0) return;
  // While backfilling icons, also fill in display_name (the UI display name): same request, and Twitch's quota is effectively unlimited.
  await fetchTwitchUserMeta(
    missing.map((c) => c.id),
    true,
  );
}
