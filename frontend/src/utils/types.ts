/* eslint-disable camelcase */

// ---------- Types for the MultiView backend API ----------

/**
 * Minimal set of video fields returned to the frontend. The Holodex-specific fields
 * that VideoCard.vue reads are guarded with v-if / optional chaining, so anything
 * not included here is automatically hidden.
 */
export interface VideoItem {
    id: string;
    title: string;
    type: "stream" | "placeholder" | "video";
    status: "live" | "upcoming" | "past";
    topic_id?: string;
    published_at: string;
    start_scheduled?: string;
    start_actual?: string;
    end_actual?: string;
    duration?: number;
    thumbnail: string;
    channel: {
        id: string;
        platform: "youtube" | "twitch";
        name: string;
        thumbnail: string;
    };
}

/**
 * An element of GET /api/channels. Used by the channel list page.
 * live / video are the fetch-target flags (display only; config.yaml is the source of truth).
 */
export interface ChannelListItem {
    id: string;
    platform: "youtube" | "twitch";
    name: string;
    thumbnail: string;
    // YouTube @handle (customUrl). Used to resolve icons by handle for shared URLs. Empty if not fetched.
    handle: string;
    live: boolean;
    video: boolean;
}

/** Response envelope of GET /api/videos/live and /api/videos/archive */
export interface VideosResponse {
    items: VideoItem[];
    last_updated: string | null;
}

export interface RefreshState {
    status: "idle" | "running";
    last_updated: string | null;
    last_error: string | null;
    started_at: string | null;
}

/** Response of GET /api/refresh/status */
export interface RefreshStatusResponse {
    live: RefreshState;
    archive: RefreshState;
}

/** Response of GET /api/quota */
export interface QuotaState {
    date: string;
    used: number;
    limit: number;
    last_call_at: string | null;
    exceeded: boolean;
}

/** Arbitrary link shown e.g. at the bottom of the hamburger menu (same shape as site_links in config.yaml). */
export interface SiteLink {
    label: string;
    url: string;
    icon?: string;
}

/** Response of GET /api/config/public (contains no secrets) */
export interface PublicConfig {
    public_refresh_enabled: boolean;
    site_name: string;
    site_links: SiteLink[];
}

// ---------- The following come from Holodex (kept because some remaining components may still reference them) ----------
export type Playlist = { id?: number; name: string; user_id: number | string; videos?: Object[] };
export type PlaylistListItem = { id?: number; name: string; user_id: number | string; videos?: string[] };
export type PlaylistList = [PlaylistListItem];

export type User = {
    id: string;
    username: string;
    yt_channel_key?: string;
    role: string;
    created_at: string;
    contribution_count: string;
    twitter_id?: string;
    google_id?: string;
    discord_id?: string;
    api_key?: string;
};
