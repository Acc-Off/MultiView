<template>
  <v-container fluid class="d-flex flex-column ch-page">
    <!-- Search field and filter (left edge aligned with the list) -->
    <div class="ch-search mb-2">
      <v-text-field
        v-model="query"
        :label="$t('views.channels.searchLabel')"
        :prepend-inner-icon="icons.mdiMagnify"
        density="compact"
        hide-details
        clearable
        variant="outlined"
        style="max-width: 480px"
      />
      <!-- In upstream Holodex (Vuetify 2) every button has the surface background
           (dark #272727 / light #f5f5f5) and only the selected button has primary-colored
           text (no fill).
           Vuetify 3's default variant="elevated" fills the selected button with primary,
           while variant="text" makes the background transparent; neither matches upstream.
           So variant="text" is kept (no primary fill on selection) and the upstream surface
           background is restored on all buttons with CSS. -->
      <v-btn-toggle v-model="filterMode" mandatory density="compact" class="mt-2 ch-filter-toggle" color="primary" variant="text">
        <v-btn value="all" size="small">
          {{ $t("views.channels.filterAll") }}
        </v-btn>
        <v-btn value="favorite" size="small">
          <v-icon start size="small">
            {{ icons.mdiHeart }}
          </v-icon>
          {{ $t("views.channels.favorite") }}
        </v-btn>
        <v-btn value="hidden" size="small">
          <v-icon start size="small">
            {{ icons.mdiEyeOff }}
          </v-icon>
          {{ $t("views.channels.hidden") }}
        </v-btn>
      </v-btn-toggle>
    </div>

    <div v-if="!channels.length" class="ma-auto text-medium-emphasis">
      {{ $t("views.channels.empty") }}
    </div>
    <div v-else-if="!filtered.length" class="ma-auto text-medium-emphasis">
      {{ $t("views.channels.noMatch") }}
    </div>

    <!-- Virtual scroll: mount only the rows in view so the page stays light even with many channels -->
    <v-virtual-scroll
      v-else
      :items="filtered"
      :item-height="ROW_HEIGHT"
      :bench="4"
      class="ch-list"
    >
      <template #default="{ item: ch }">
        <ChannelRow
          :key="ch.id"
          :channel="ch"
          :style="{ height: `${ROW_HEIGHT}px` }"
          :live="liveChannelIds.has(ch.id)"
          :favorited="favoriteChannelIDs.has(ch.id)"
          :hidden="blockedChannelIDs.has(ch.id)"
          :volume-entry="volumesMap[channelKey(ch)] || null"
          @toggle-favorite="toggleFavorite(ch)"
          @toggle-hidden="toggleHidden(ch)"
          @set-volume="setVolume(ch, $event)"
        />
      </template>
    </v-virtual-scroll>
  </v-container>
</template>

<script lang="ts">
import { mapGetters, mapState } from "@/store/helpers";
import { useHomeStore } from "@/store/home.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useSettingsStore } from "@/store/settings.store";
import { useVolumeStore } from "@/store/volume.store";
import { siteTitle } from "@/utils/site";
import ChannelRow from "@/components/channel/ChannelRow.vue";

export default {
    name: "ChannelList",
    head() {
        const vm = this;
        return {
            get title() {
                return siteTitle(vm.$t("views.channels.title"));
            },
        };
    },
    components: {
        ChannelRow,
    },
    data() {
        return {
            query: "",
            // "all" | "favorite" | "hidden"
            filterMode: "all",
            // Fixed height of each row (passed to the virtual scroller's item-height; includes the bottom border)
            ROW_HEIGHT: 64,
        };
    },
    computed: {
        ...mapState("home", { channels: "channels", live: "live" }),
        ...mapGetters("favorites", ["favoriteChannelIDs"]),
        ...mapGetters("settings", ["blockedChannelIDs"]),
        // Dictionary of channel volumes (passed to rows as props to avoid getter calls inside each row).
        // The same object the MultiView media controls use.
        volumesMap() {
            return useVolumeStore().volumes || {};
        },
        liveChannelIds() {
            return new Set(
                (this.live || []).filter((v) => v.status === "live").map((v) => v.channel.id),
            );
        },
        sortedChannels() {
            return [...this.channels].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        },
        filtered() {
            let list = this.sortedChannels;
            // Filter (all / favorites / hidden)
            if (this.filterMode === "favorite") {
                const ids = this.favoriteChannelIDs;
                list = list.filter((c) => ids.has(c.id));
            } else if (this.filterMode === "hidden") {
                const ids = this.blockedChannelIDs;
                list = list.filter((c) => ids.has(c.id));
            }
            // Search by name
            const q = (this.query || "").trim().toLowerCase();
            if (q) list = list.filter((c) => (c.name || "").toLowerCase().includes(q));
            return list;
        },
    },
    created() {
        const home = useHomeStore();
        home.fetchChannels({ force: false });
        // For the LIVE badge. Left to the volatile cache restore and polling; nothing breaks without it.
        home.fetchLive({ force: false });
    },
    methods: {
        // Volume keys use the same format as VideoCell.channelKey.
        channelKey(ch) {
            return ch.platform === "youtube" ? `youtube:${ch.id}` : `twitch:${ch.id}`;
        },
        toggleFavorite(ch) {
            useFavoritesStore().toggleFavorite({ id: ch.id, name: ch.name });
        },
        toggleHidden(ch) {
            // settings.blockedChannels stores { id, name } (filterVideos looks entries up by id).
            useSettingsStore().toggleBlocked({ id: ch.id, name: ch.name });
        },
        setVolume(ch, { volume, muted }) {
            useVolumeStore().setVolume({
                channelKey: this.channelKey(ch),
                volume,
                muted,
            });
        },
    },
};
</script>

<style scoped>
/* Fit the page to the viewport height so that only the inner virtual scroller scrolls
   (avoids double scrolling together with the page itself). Subtract the 64px top bar. */
.ch-page {
    height: calc(100vh - 64px);
    overflow: hidden;
}
/* Cap the width of the whole list and center it so that names and controls do not end up
   too far apart on wide screens. The virtual scroller scrolls inside its container, so give
   it all of the remaining height. */
.ch-list {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
    flex: 1 1 auto;
    min-height: 0;
}
/* Align the search field's left edge with the list and keep it within the same max width */
.ch-search {
    width: 100%;
    max-width: 760px;
    margin: 0 auto;
}
.ch-search .v-input {
    max-width: 480px;
}
/* Divider between rows (a virtual scroller cannot have dividers as separate items, so each row carries its own) */
.ch-list :deep(.ch-row-border) {
    border-bottom: 1px solid rgb(var(--v-theme-surface-light, var(--v-theme-surface)));
}
</style>

<!-- Restores the upstream Holodex surface background on the filter (v-btn-toggle).
     In Vuetify 2 every button has the surface background (dark #272727 / light #f5f5f5) and
     only the selected one has primary-colored text.
     .v-theme--dark is set outside the component (on the ancestor .v-application) and cannot be
     matched from scoped styles, so the colors are set per theme in an unscoped style block. -->
<style>
.ch-filter-toggle .v-btn {
    background-color: #f5f5f5;
}
.v-theme--dark .ch-filter-toggle .v-btn {
    background-color: #272727;
}
</style>
