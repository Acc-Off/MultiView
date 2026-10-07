import axios from "axios";
import type {
    VideosResponse,
    RefreshStatusResponse,
    PublicConfig,
    QuotaState,
    ChannelListItem,
} from "./types";

export const API_BASE_URL = `${window.location.origin}/api`;
export const SITE_BASE_URL = `${window.location.origin}`;

export const axiosInstance = axios.create({ baseURL: API_BASE_URL, timeout: 30000 });

export type RefreshTarget = "live" | "archive" | "all";

export default {
    /** Live and upcoming streams. Returns { items, last_updated } */
    live(): Promise<VideosResponse> {
        return axiosInstance.get<VideosResponse>("/videos/live", { timeout: 10000 }).then((r) => r.data);
    },
    /** Archived videos. Returns { items, last_updated } */
    videos(): Promise<VideosResponse> {
        return axiosInstance.get<VideosResponse>("/videos/archive").then((r) => r.data);
    },
    /** Registered channels (with live/video flags) */
    channels(): Promise<ChannelListItem[]> {
        return axiosInstance.get("/channels").then((r) => r.data.channels);
    },
    /**
     * Starts a manual refresh and just receives an immediate 202 (does not wait for completion).
     * Returns 403 if public_refresh_enabled=false and the caller is not authorized.
     */
    startRefresh(target: RefreshTarget = "all", adminToken?: string) {
        return axiosInstance.post(`/refresh?target=${target}`, null, {
            headers: adminToken ? { Authorization: `Bearer ${adminToken}` } : {},
        });
    },
    /** Refresh state of each target (polled to detect completion) */
    refreshStatus(): Promise<RefreshStatusResponse> {
        return axiosInstance.get<RefreshStatusResponse>("/refresh/status").then((r) => r.data);
    },
    /** Public settings (public_refresh_enabled / site_name / site_links). Contains no secrets */
    publicConfig(): Promise<PublicConfig> {
        return axiosInstance.get<PublicConfig>("/config/public").then((r) => r.data);
    },
    /** YouTube quota usage */
    quota(): Promise<QuotaState> {
        return axiosInstance.get<QuotaState>("/quota").then((r) => r.data);
    },
};
