<template>
  <v-container
    fluid
    style="min-height: 100%"
    class="d-flex flex-column"
  >
    <!-- Toolbar: tabs, refresh button, last fetched time -->
    <div class="d-flex align-center flex-wrap mb-2" style="gap: 8px">
      <!-- Upstream Holodex (Vuetify 2) put `secondary darken-1`/`primary lighten-1` on `.v-tabs`,
           but the inner `.v-tabs-bar` (opaque surface) covered the whole band, so the band color
           actually visible was surface (dark=#1e1e1e / light=#fff), not secondary/primary.
           In Vuetify 3 `.v-slide-group__container` is transparent and secondary would show
           across the whole band, so the tint classes are dropped and the band uses the surface
           color to reproduce the upstream look. -->
      <v-tabs
        v-model="tab"
        color="primary"
        class="fave-tabs"
        style="flex: 1 1 auto; min-width: 200px"
      >
        <v-tab class="pa-2">
          {{ $t("views.home.liveOrUpcomingHeading") }}
          <span class="stream-count-chip mx-1 rounded-md bg-primary text-white rounded-lg pa-1">
            {{ lives.length }}
          </span>
          /
          <span class="stream-count-chip ml-1 rounded-md bg-primary text-white rounded-lg pa-1">
            {{ upcoming.length }}
          </span>
        </v-tab>
        <v-tab class="pa-2">
          {{ $t("component.mainNav.archive") }}
          <span class="stream-count-chip ml-1 rounded-md bg-primary text-white rounded-lg pa-1">
            {{ archives.length }}
          </span>
        </v-tab>
      </v-tabs>

      <div class="d-flex align-center" style="gap: 8px">
        <span class="text-caption text-medium-emphasis">
          {{ lastUpdatedLabel }}
        </span>
        <v-btn variant="text" icon @click="toggleDisplayMode">
          <v-icon>{{ displayIcon }}</v-icon>
        </v-btn>
        <v-btn
          v-if="publicRefreshEnabled"
          size="small"
          color="primary"
          :loading="refreshing"
          :disabled="refreshing"
          @click="manualRefresh"
        >
          <v-icon start size="small">
            {{ icons.mdiRefresh }}
          </v-icon>
          {{ $t("views.app.update_text") }}
        </v-btn>
      </div>
    </div>

    <v-alert
      v-if="refreshError"
      type="error"
      density="compact"
      closable
      @click:close="refreshError = ''"
    >
      {{ refreshError }}
    </v-alert>

    <LoadingOverlay :is-loading="isLoading" :show-error="hasError" />

    <!-- Live / scheduled streams tab -->
    <template v-if="tab === 0">
      <div v-if="lives.length" class="mb-2 text-h6">
        {{ $t("views.home.live") }}
      </div>
      <VideoCardList
        v-if="lives.length"
        :videos="lives"
        include-channel
        :include-avatar="shouldIncludeAvatar"
        :cols="colSizes"
        :dense="currentGridSize > 0"
        :dense-list="homeViewMode === 'denseList'"
        :horizontal="homeViewMode === 'list'"
      />
      <div v-if="upcoming.length" class="mb-2 mt-4 text-h6">
        {{ $t("views.home.upcoming") }}
      </div>
      <VideoCardList
        v-if="upcoming.length"
        :videos="upcoming"
        include-channel
        :include-avatar="shouldIncludeAvatar"
        :cols="colSizes"
        :dense="currentGridSize > 0"
        :dense-list="homeViewMode === 'denseList'"
        :horizontal="homeViewMode === 'list'"
      />
      <div v-if="!isLoading && !lives.length && !upcoming.length" class="ma-auto text-medium-emphasis">
        {{ $t("views.search.noResults") }}
      </div>
    </template>

    <!-- Archive tab -->
    <template v-else>
      <VideoCardList
        :videos="archives"
        include-channel
        :include-avatar="shouldIncludeAvatar"
        :cols="colSizes"
        :dense="currentGridSize > 0"
        :dense-list="homeViewMode === 'denseList'"
        :horizontal="homeViewMode === 'list'"
      />
      <div v-if="!isLoadingArchive && !archives.length" class="ma-auto text-medium-emphasis">
        {{ $t("views.search.noResults") }}
      </div>
    </template>
  </v-container>
</template>

<script lang="ts">
import { mapState, mapGetters } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { useHomeStore } from "@/store/home.store";
import api from "@/utils/backend-api";
import { siteTitle } from "@/utils/site";
import { dayjs, isStaleUpcoming } from "@/utils/time";
import VideoCardList from "@/components/video/VideoCardList.vue";
import LoadingOverlay from "@/components/common/LoadingOverlay.vue";

export default {
    name: "HomeFave",
    head() {
        const vm = this;
        return {
            get title() {
                if (vm.isFavPage) return siteTitle(vm.$t("component.mainNav.favorites"));
                return siteTitle();
            },
        };
    },
    components: {
        LoadingOverlay,
        VideoCardList,
    },
    props: {
        isFavPage: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            tab: 0,
            refreshing: false,
            refreshError: "",
            statusTimer: null,
        };
    },
    computed: {
        ...mapState("home", {
            h_live: "live",
            h_archive: "archive",
            isLoading: "isLoading",
            isLoadingArchive: "isLoadingArchive",
            hasError: "hasError",
            liveLastUpdated: "liveLastUpdated",
            archiveLastUpdated: "archiveLastUpdated",
        }),
        ...mapGetters("favorites", ["favoriteChannelIDs"]),
        ...mapState("settings", ["darkMode"]),
        ...mapState("root", ["visibilityState"]),
        publicRefreshEnabled() {
            return useSettingsStore().publicRefreshEnabled;
        },
        // Display mode (grid / list / denseList). Persisted in the settings store.
        homeViewMode: {
            get() {
                return useSettingsStore().homeViewMode;
            },
            set(val) {
                useSettingsStore().setHomeViewMode(val);
            },
        },
        // Column-count step within grid mode (0 = 4 columns / 1 = 5 columns / 2 = 6 columns). Persisted in the root store.
        currentGridSize: {
            get() {
                return useRootStore().currentGridSize;
            },
            set(val) {
                useRootStore().setCurrentGridSize(val);
            },
        },
        // Compute the number of columns per breakpoint from currentGridSize.
        colSizes() {
            return {
                xs: 1 + this.currentGridSize,
                sm: 2 + this.currentGridSize,
                md: 3 + this.currentGridSize,
                lg: 4 + this.currentGridSize,
                xl: 5 + this.currentGridSize,
                xxl: 5 + this.currentGridSize,
            };
        },
        // When the grid gets dense, omit avatars to keep the cards light.
        shouldIncludeAvatar() {
            if (this.$vuetify.display.md && this.currentGridSize > 1) return false;
            if (this.$vuetify.display.sm && this.currentGridSize > 0) return false;
            if (this.$vuetify.display.xs && this.currentGridSize > 0) return false;
            return true;
        },
        // Icon shown on the toggle button (indicates the current display mode).
        displayIcon() {
            switch (true) {
                case this.homeViewMode === "list":
                    return this.icons.mdiFormatListBulleted;
                case this.homeViewMode === "denseList":
                    return this.icons.mdiViewGrid;
                case this.currentGridSize === 1:
                    return this.icons.mdiViewComfy;
                case this.currentGridSize === 2:
                    return this.icons.mdiViewList;
                default:
                    return this.icons.mdiViewModule;
            }
        },
        // When isFavPage is set, narrow down to favorite channels only
        filteredLive() {
            if (!this.isFavPage) return this.h_live;
            const ids = this.favoriteChannelIDs;
            return this.h_live.filter((v) => ids.has(v.channel.id));
        },
        filteredArchive() {
            if (!this.isFavPage) return this.h_archive;
            const ids = this.favoriteChannelIDs;
            return this.h_archive.filter((v) => ids.has(v.channel.id));
        },
        lives() {
            return this.filteredLive.filter((v) => v.status === "live");
        },
        upcoming() {
            // Exclude stale upcoming scheduled streams that never started (well past their
            // scheduled time, or left untouched after creation).
            // A slightly delayed stream turns live once it starts, so it does not linger here.
            const list = this.filteredLive.filter((v) => v.status === "upcoming" && !isStaleUpcoming(v));
            // Scheduled streams with no start time yet (no start_scheduled) go last: those with a
            // confirmed time come first, those with an unknown start come after. The original
            // relative order is kept within each rank (stable).
            return list
                .map((v, i) => ({ v, i, rank: v.start_scheduled ? 0 : 1 }))
                .sort((a, b) => a.rank - b.rank || a.i - b.i)
                .map((x) => x.v);
        },
        archives() {
            return this.filteredArchive;
        },
        lastUpdatedLabel() {
            const ts = this.tab === 0 ? this.liveLastUpdated : this.archiveLastUpdated;
            if (!ts) return this.$t("views.app.untilOnline");
            return `${this.$t("component.search.date")}: ${dayjs(ts).fromNow()}`;
        },
    },
    watch: {
        tab() {
            this.$nextTick(() => window.scrollTo(0, 0));
            // Fetch when the archive tab is opened. force:true so that it also fetches while
            // visibilityState=hidden (e.g. DevTools in a separate window). Refetches if the data
            // has not been fetched yet or is stale.
            if (this.tab === 1) useHomeStore().fetchArchive({ force: true });
        },
        visibilityState() {
            if (this.visibilityState === "visible") {
                useHomeStore().fetchLive({ force: false });
            }
        },
    },
    created() {
        useHomeStore().fetchLive({ force: false });
    },
    beforeUnmount() {
        if (this.statusTimer) clearInterval(this.statusTimer);
    },
    methods: {
        // A single button cycles through grid (4, then 5, then 6 columns), list, and denseList.
        toggleDisplayMode() {
            const viewModes = ["grid", "list", "denseList"];
            const nextViewMode = viewModes[
                (viewModes.indexOf(this.homeViewMode) + 1) % viewModes.length
            ];

            if (this.homeViewMode === "grid" && this.currentGridSize < 2) {
                this.currentGridSize += 1;
            } else {
                this.homeViewMode = nextViewMode;
                this.currentGridSize = 0;
            }
        },
        async manualRefresh() {
            const target = this.tab === 0 ? "live" : "archive";
            this.refreshError = "";
            this.refreshing = true;
            try {
                await api.startRefresh(target);
                this.pollStatus(target);
            } catch (e) {
                this.refreshing = false;
                if (e?.response?.status === 403) {
                    this.refreshError = this.$t("views.app.loginError");
                } else {
                    this.refreshError = `${e?.message || e}`;
                }
            }
        },
        pollStatus(target) {
            if (this.statusTimer) clearInterval(this.statusTimer);
            let elapsed = 0;
            this.statusTimer = setInterval(async () => {
                elapsed += 2;
                try {
                    const status = await api.refreshStatus();
                    const st = status[target];
                    if (st.status === "idle") {
                        clearInterval(this.statusTimer);
                        this.statusTimer = null;
                        this.refreshing = false;
                        // live aggregates YouTube and Twitch. Twitch may still be updated even when
                        // YouTube fails because the quota is exceeded, so load the data whether or
                        // not there was an error and show the error alongside it.
                        if (target === "live") {
                            useHomeStore().fetchLive({ force: true });
                        } else {
                            useHomeStore().fetchArchive({ force: true });
                        }
                        if (st.last_error) {
                            this.refreshError = st.last_error;
                        }
                    }
                } catch (e) {
                    console.error(e);
                }
                // Safety valve: give up after 60 seconds
                if (elapsed >= 60) {
                    clearInterval(this.statusTimer);
                    this.statusTimer = null;
                    this.refreshing = false;
                }
            }, 2000);
        },
    },
};
</script>

<style>
.stream-count-chip {
    letter-spacing: normal;
    min-width: 24px;
}
/* Reproduces the visible tab band color of upstream Holodex (Vuetify 2), i.e. the surface
   color of the inner v-tabs-bar that covered it. dark=#1e1e1e / light=#fff
   (do not overlook the fill of the parent element). */
.fave-tabs {
    background-color: #fff;
}
.v-theme--dark .fave-tabs {
    background-color: #1e1e1e;
}
</style>
