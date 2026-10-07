/* eslint-disable no-shadow */
import { defineStore } from "pinia";

// In MultiView, favorites are kept entirely locally (localStorage).
// favorites: an array of { id, name }. There is no server sync.
function initialState() {
    return {
        favorites: [],
    };
}

export const useFavoritesStore = defineStore("favorites", {
    state: initialState,
    getters: {
        isFavorited: (state) => (channelId) => !!state.favorites.find((f) => f.id === channelId),
        favoriteChannelIDs: (state) => new Set(state?.favorites?.map((f) => f.id) || []),
    },
    actions: {
        setFavorites(favorites) {
            this.favorites = favorites;
        },
        resetFavorites() {
            this.setFavorites([]);
        },
        /**
         * Toggles a favorite on or off. channel is expected to be { id, name }.
         * A string (id only) is also accepted, in which case the id is used as the name.
         */
        toggleFavorite(channel) {
            const id = typeof channel === "string" ? channel : channel.id;
            const idx = this.favorites.findIndex((f) => f.id === id);
            if (idx >= 0) {
                this.favorites.splice(idx, 1);
            } else {
                const entry = typeof channel === "string"
                    ? { id, name: id }
                    : { id: channel.id, name: channel.name };
                this.favorites.push(entry);
            }
            // Replace the array reference to make sure reactivity is triggered
            this.favorites = this.favorites.slice();
        },
        resetState() {
            Object.assign(this, initialState());
        },
    },
    persist: {
        key: "multiview-favorites-v1",
        pick: ["favorites"],
    },
});
