/* eslint-disable no-shadow */
import { defineStore } from "pinia";
import api from "@/utils/backend-api";
import { videoTemporalComparator } from "@/utils/functions";
import { useRootStore } from "./root.store";

function initialState() {
    return {
        live: [],
        archive: [],
        // Registered channels (GET /api/channels). Used e.g. to show icons for favorites.
        channels: [],
        lastChannelsUpdate: 0,
        isLoading: true,
        isLoadingArchive: true,
        hasError: false,
        hasErrorArchive: false,
        lastLiveUpdate: 0,
        lastArchiveUpdate: 0,
        // Time of the server's last fetch (ISO 8601 string or null)
        liveLastUpdated: null,
        archiveLastUpdated: null,
    };
}

export const useHomeStore = defineStore("home", {
    state: initialState,
    getters: {
        // Map of channel id → icon URL. ChannelImg looks icons up here (the single source for icons).
        channelThumbnails(state) {
            const map = {};
            for (const c of state.channels) {
                if (c.thumbnail) map[c.id] = c.thumbnail;
            }
            return map;
        },
        // Map of @handle → icon URL. For YouTube cells restored from a shared URL, oembed only returns
        // /@handle and no UC channel id, so this is the fallback for looking up the icon by handle.
        channelThumbnailsByHandle(state) {
            const map = {};
            for (const c of state.channels) {
                if (c.thumbnail && c.handle) map[c.handle] = c.thumbnail;
            }
            return map;
        },
    },
    actions: {
        fetchLive({ force = false, minutes = 2 } = {}) {
            const root = useRootStore();
            if (root.visibilityState === "hidden" && !force) {
                return null;
            }
            if (
                this.hasError
                || force
                || !this.lastLiveUpdate
                || Date.now() - this.lastLiveUpdate > minutes * 60 * 1000
            ) {
                this.fetchStart();
                return api
                    .live()
                    .then((res) => {
                        const items = (res.items || []).slice().sort(videoTemporalComparator);
                        this.setLive({ items, lastUpdated: res.last_updated });
                        this.fetchEnd();
                    })
                    .catch((e) => {
                        console.error(e);
                        this.fetchError();
                    });
            }
            return null;
        },
        fetchArchive({ force = false, minutes = 10 } = {}) {
            const root = useRootStore();
            if (root.visibilityState === "hidden" && !force) {
                return null;
            }
            if (
                this.hasErrorArchive
                || force
                || !this.lastArchiveUpdate
                || Date.now() - this.lastArchiveUpdate > minutes * 60 * 1000
            ) {
                this.fetchArchiveStart();
                return api
                    .videos()
                    .then((res) => {
                        const items = (res.items || []).slice().sort(videoTemporalComparator);
                        this.setArchive({ items, lastUpdated: res.last_updated });
                        this.fetchArchiveEnd();
                    })
                    .catch((e) => {
                        console.error(e);
                        this.fetchArchiveError();
                    });
            }
            return null;
        },
        fetchChannels({ force = false, minutes = 30 } = {}) {
            if (
                force
                || !this.lastChannelsUpdate
                || Date.now() - this.lastChannelsUpdate > minutes * 60 * 1000
            ) {
                return api
                    .channels()
                    .then((channels) => {
                        this.setChannels(channels || []);
                    })
                    .catch((e) => {
                        console.error(e);
                    });
            }
            return null;
        },
        fetchStart() {
            this.isLoading = true;
            this.hasError = false;
        },
        fetchEnd() {
            this.isLoading = false;
        },
        fetchError() {
            this.hasError = true;
            this.isLoading = false;
        },
        setLive({ items, lastUpdated }) {
            this.live = items;
            this.liveLastUpdated = lastUpdated;
            this.lastLiveUpdate = Date.now();
        },
        fetchArchiveStart() {
            this.isLoadingArchive = true;
            this.hasErrorArchive = false;
        },
        fetchArchiveEnd() {
            this.isLoadingArchive = false;
        },
        fetchArchiveError() {
            this.hasErrorArchive = true;
            this.isLoadingArchive = false;
        },
        setArchive({ items, lastUpdated }) {
            this.archive = items;
            this.archiveLastUpdated = lastUpdated;
            this.lastArchiveUpdate = Date.now();
        },
        setChannels(channels) {
            this.channels = channels;
            this.lastChannelsUpdate = Date.now();
        },
        resetState() {
            Object.assign(this, initialState());
        },
    },
    // The home store is not persisted.
});
