/* eslint-disable no-shadow */
import { defineStore } from "pinia";

// Persists per-channel volume and mute state.
// key: `youtube:<channelId>` or `twitch:<channelName>` (same format as VideoCell.channelKey)
//
// This single dictionary is the only source of truth for channel volume. The multiview media
// controls and the sliders on the channel list page both read and write the same entries.
// (A separate "default volume" dictionary (defaults) used to exist, but once copied into volumes
//   on first playback it was never read again, so changes made on the channel list page had no
//   effect; the two were therefore merged.)
export interface VolumeEntry {
    volume: number; // 0-100
    muted: boolean;
}

interface VolumeState {
    volumes: Record<string, VolumeEntry>;
}

const initialState = (): VolumeState => ({
    volumes: {},
});

export const useVolumeStore = defineStore("volume", {
    state: initialState,
    getters: {
        /** Returns the saved volume entry for a channel key (undefined if there is none) */
        volumeFor: (state) => (channelKey: string): VolumeEntry | undefined => state.volumes[channelKey],
    },
    actions: {
        setVolume({ channelKey, volume, muted }: { channelKey: string; volume: number; muted: boolean }) {
            const cur = this.volumes[channelKey];
            // Skip the write when nothing changed. VideoCell watches the store and applies changes to
            // playing cells immediately, so unconditionally assigning a new object would loop:
            // watch → setVolume → write-back → watch. This also avoids needless localStorage writes
            // (i.e. chains of storage events from cross-tab sync).
            if (cur && cur.volume === volume && cur.muted === muted) return;
            this.volumes[channelKey] = { volume, muted };
        },
        setVolumes(volumes: Record<string, VolumeEntry>) {
            this.volumes = volumes || {};
        },
        /** Imports the legacy "default volume" dictionary. Only fills keys that have no saved value (existing actual values take precedence). */
        mergeVolumes(entries: Record<string, VolumeEntry>) {
            if (!entries) return;
            Object.entries(entries).forEach(([key, entry]) => {
                if (!this.volumes[key] && entry && typeof entry.volume === "number") {
                    this.volumes[key] = { volume: entry.volume, muted: !!entry.muted };
                }
            });
        },
        resetState() {
            Object.assign(this, initialState());
        },
    },
    persist: {
        key: "multiview-volume-v1",
        // Data persisted by older versions has { volumes, defaults }. $patch adds defaults to
        // the state, so fold it into volumes and then drop it (one-time migration).
        afterHydrate: (ctx) => {
            const state = ctx.store.$state as VolumeState & { defaults?: Record<string, VolumeEntry> };
            if (!state.defaults) return;
            (ctx.store as any).mergeVolumes(state.defaults);
            delete state.defaults;
        },
    },
});
