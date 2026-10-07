<template>
  <!-- Vertical: modal view (tabs on the left, grid on the right) -->
  <v-card v-if="!horizontal" class="pa-3">
    <v-row class="flex-nowrap" style="height: 80vh">
      <!-- Left column: All / Favorites / YouTube URL / Twitch URL -->
      <v-col
        class="org-list"
        cols="3"
        sm="3"
        md="3"
        lg="2"
      >
        <v-card-title class="pa-0 pb-2 text-subtitle-1">{{ $t("views.multiview.video.selectLive") }}</v-card-title>
        <org-panel-picker @changed="handlePicker" />
      </v-col>
      <!-- Right column: Live & Upcoming / Archive toggle plus the card grid -->
      <v-col
        ref="container"
        class="video-list"
        cols="9"
        sm="9"
        md="9"
        lg="10"
      >
        <template v-if="isUrl">
          <h4 class="pa-1">
            {{ $t("views.multiview.video.addCustomVideo") }}
          </h4>
          <custom-url-field
            :twitch="selectedPanel.name === 'TwitchURL'"
            @onSuccess="handleVideoClick"
          />
        </template>
        <template v-else>
          <div class="d-flex align-center mb-2">
            <v-btn-toggle v-model="tab" density="compact" mandatory>
              <v-btn :value="0" size="small">
                {{ $t("views.home.liveOrUpcomingHeading") }}
              </v-btn>
              <v-btn :value="1" size="small">
                {{ $t("component.mainNav.archive") }}
              </v-btn>
            </v-btn-toggle>
            <v-icon
              class="ml-2"
              :class="{ 'refresh-spin': isLoading }"
              @click="loadSelection(true)"
            >
              {{ icons.mdiRefresh }}
            </v-icon>
            <!-- An invalid regex shows the error state (while falling back to substring matching). The title
                 attribute does not pass through to v-text-field's root, so put it on the wrapper div to
                 show the reason on hover. -->
            <div class="title-filter ml-3" :title="titleFilterInvalid ? $t('views.multiview.video.titleFilterInvalid') : undefined">
              <v-text-field
                v-model="titleFilter"
                density="compact"
                variant="outlined"
                hide-details
                clearable
                single-line
                :label="$t('views.multiview.video.titleFilter')"
                :error="titleFilterInvalid"
                :prepend-inner-icon="titleFilterInvalid ? icons.mdiAlertCircleOutline : icons.mdiMagnify"
              />
            </div>
          </div>
          <VideoCardList
            :videos="displayedVideos"
            include-channel
            include-avatar
            dense
            :cols="selectorCols"
            disable-default-click
            in-multi-view-selector
            @videoClicked="handleVideoClick"
          />
          <div
            v-if="!isLoading && !displayedVideos.length"
            class="pa-4 text-center text-medium-emphasis"
          >
            {{ $t("views.search.noResults") }}
          </div>
          <div class="d-block" style="height: 120px" />
        </template>
      </v-col>
    </v-row>
  </v-card>
  <!-- Horizontal view for tool bar -->
  <div
    v-else
    class="d-flex align-center overflow-hidden"
  >
    <org-panel-picker horizontal class="d-flex" @changed="handlePicker" />
    <v-icon
      v-if="!isUrl"
      class="d-flex mr-2 ml-1"
      :class="{ 'refresh-spin': isLoading }"
      @click="loadSelection(true)"
    >
      {{ icons.mdiRefresh }}
    </v-icon>
    <template v-if="isUrl">
      <custom-url-field
        :twitch="selectedPanel.name === 'TwitchURL'"
        slim
        @onSuccess="handleVideoClick"
      />
    </template>
    <template v-else>
      <!-- Filter by keyword/regex on the stream title (e.g. enter an event name to keep only that event's streams).
           The value is persisted in the multiview store and shared by both instances: the top bar and
           the selection dialog. -->
      <div class="title-filter-slim mr-2" :title="titleFilterInvalid ? $t('views.multiview.video.titleFilterInvalid') : undefined">
        <v-text-field
          v-model="titleFilter"
          density="compact"
          variant="solo"
          hide-details
          clearable
          single-line
          :label="$t('views.multiview.video.titleFilter')"
          :error="titleFilterInvalid"
          :prepend-inner-icon="titleFilterInvalid ? icons.mdiAlertCircleOutline : icons.mdiMagnify"
        />
      </div>
      <div ref="videosBar" class="videos-bar d-flex flex-shrink-1 overflow-x-auto overflow-y-hidden" @wheel="scrollHandler">
        <!-- perf: each channel in the top bar is extracted into ChannelBarItem. With Vuetify 3's v-tooltip
             inlined in VideoSelector, its slot gets dragged into the parent's (MultiView) re-render and
             re-runs for nothing, producing a long task just from opening a dialog (0ms in Vuetify 2).
             With a component boundary in between, Vue 3 skips the re-render when the props (video/tick)
             are unchanged, which stops the propagation. -->
        <ChannelBarItem
          v-for="video in topFilteredLive"
          :key="video.id"
          :video="video"
          :tick="tick"
          @videoClicked="handleVideoClick"
        />
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import VideoCardList from "@/components/video/VideoCardList.vue";
import { dayjs, isStaleUpcoming } from "@/utils/time";
import { mapGetters, mapState } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useHomeStore } from "@/store/home.store";
import { useMultiviewStore } from "@/store/multiview.store";
import OrgPanelPicker from "@/components/multiview/OrgPanelPicker.vue";
import { mdiTwitch } from "@mdi/js";
import CustomUrlField from "./CustomUrlField.vue";
import ChannelBarItem from "./ChannelBarItem.vue";

export default {
    name: "VideoSelector",
    components: {
        VideoCardList,
        OrgPanelPicker,
        CustomUrlField,
        ChannelBarItem,
    },
    props: {
        horizontal: {
            type: Boolean,
            default: false,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    data() {
        return {
            selectedPanel: { name: "Live" },
            // Right-column tab: 0 = Live & Upcoming / 1 = Archive
            tab: 0,
            isLoading: false,
            tick: Date.now(),
            ticker: null,
            refreshTimer: null,
            mdiTwitch,
        };
    },
    computed: {
        ...mapGetters("multiview", ["activeVideos"]),
        ...mapGetters("favorites", ["favoriteChannelIDs"]),
        ...mapGetters("settings", ["blockedChannelIDs"]),
        ...mapState("home", { homeUpdateTick: "lastLiveUpdate" }),
        ...mapState("root", ["visibilityState"]),
        isFavorites() {
            return this.selectedPanel.name === "Favorites";
        },
        // Stream title filter string (persisted in the multiview store; shared by the top bar and the dialog)
        titleFilter: {
            get() {
                return useMultiviewStore().titleFilter || "";
            },
            set(v) {
                useMultiviewStore().titleFilter = v || "";
            },
        },
        // Interpret the filter string as a (case-insensitive) regex. If it is an invalid regex, e.g.
        // because of a half-typed "(", fall back to (case-insensitive) substring matching.
        titleMatcher() {
            const q = this.titleFilter.trim();
            if (!q) return { test: null, invalid: false };
            try {
                const re = new RegExp(q, "i");
                return { test: (t) => re.test(t), invalid: false };
            } catch {
                const lower = q.toLowerCase();
                return { test: (t) => t.toLowerCase().includes(lower), invalid: true };
            }
        },
        titleFilterInvalid() {
            return this.titleMatcher.invalid;
        },
        // Playable streams from the live list (filtered to favorites on the Favorites panel; blocked channels
        // are always excluded).
        // - Stale upcoming scheduled streams that never started are excluded (same criteria as HomeFave).
        // - Sorted in three tiers: live → upcoming with a scheduled time → upcoming without one (no
        //   start_scheduled). Upstream Holodex left them mixed in API order, so old or unscheduled
        //   streams appeared ahead of live ones. Same idea as HomeFave's upcoming order (scheduled first,
        //   unscheduled last). The sort is stable, so the original order within a tier is kept.
        baseFilteredLive() {
            const lives = useHomeStore().live || [];
            const blocked = this.blockedChannelIDs;
            let list = lives.filter(
                (v) => (v.status === "live" || v.status === "upcoming")
                    && !blocked.has(v.channel.id)
                    && !isStaleUpcoming(v),
            );
            if (this.isFavorites) {
                const ids = this.favoriteChannelIDs;
                list = list.filter((v) => ids.has(v.channel.id));
            }
            list = this.applyTitleFilter(list);
            // Stable sort in the order live=0 / scheduled upcoming=1 / unscheduled upcoming=2.
            const rankOf = (v) => {
                if (v.status === "live") return 0;
                return v.start_scheduled ? 1 : 2;
            };
            return list
                .map((v, i) => ({ v, i, rank: rankOf(v) }))
                .sort((a, b) => a.rank - b.rank || a.i - b.i)
                .map((x) => x.v);
        },
        // Archives (filtered to favorites on the Favorites panel; blocked channels are always excluded)
        baseFilteredArchive() {
            const archives = useHomeStore().archive || [];
            const blocked = this.blockedChannelIDs;
            let list = archives.filter((v) => !blocked.has(v.channel.id));
            if (this.isFavorites) {
                const ids = this.favoriteChannelIDs;
                list = list.filter((v) => ids.has(v.channel.id));
            }
            return this.applyTitleFilter(list);
        },
        // List shown in the right column: the tab switches between live and archive
        displayedVideos() {
            return this.tab === 1 ? this.baseFilteredArchive : this.baseFilteredLive;
        },
        // Top bar: from baseFilteredLive (stale scheduled streams already excluded, live sorted first),
        // hide scheduled streams that are still too far off and show only the imminent ones. Live is
        // always shown; upcoming is shown only once it is within 2h of its scheduled time (6h if it is
        // among the first 8).
        // Note: an upcoming stream without start_scheduled cannot be judged as imminent (it used to slip
        //   through because dayjs(undefined) returns "now"). Unscheduled streams are not shown in the top bar.
        topFilteredLive() {
            let count = 0;
            return this.baseFilteredLive
                .filter((l) => {
                    count += 1;
                    if (l.status === "live") return true;
                    if (!l.start_scheduled) return false;
                    const scheduled = dayjs(l.start_scheduled);
                    return (
                        dayjs().isAfter(scheduled.subtract(2, "h"))
                        || (count < 8 && dayjs().isAfter(scheduled.subtract(6, "h")))
                    );
                })
                .filter((l) => !this.activeVideos.find((v) => v.id === l.id));
        },
        isUrl() {
            return ["YouTubeURL", "TwitchURL"].includes(this.selectedPanel.name);
        },
        // Grid column counts for the modal's right column (per breakpoint). It is narrower by the width
        // of the left tabs, so it is slightly tighter than the home page. Matches upstream Holodex's tiled grid.
        selectorCols() {
            return {
                xs: 1, sm: 2, md: 3, lg: 4, xl: 4, xxl: 4,
            };
        },
    },
    watch: {
        visibilityState() {
            if (this.visibilityState === "visible") {
                this.loadSelection();
            }
        },
        isActive(nw) {
            if (nw) this.loadSelection();
        },
        tab() {
            this.loadSelection();
        },
    },
    created() {
        this.setAutoRefresh();
        this.ticker = setInterval(() => {
            this.tick = Date.now();
        }, 60000);
    },
    beforeUnmount() {
        if (this.ticker) clearInterval(this.ticker);
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    },
    methods: {
        // Filter by stream title (passes everything through when the filter string is empty). Only the
        // title is matched, not the channel name; the use case is entering an event name to keep only
        // that event's streams.
        applyTitleFilter(list) {
            const { test } = this.titleMatcher;
            if (!test) return list;
            return list.filter((v) => test(v.title || ""));
        },
        scrollHandler(e) {
            this.$refs.videosBar.scrollLeft += Math.max(-53, Math.min(53, e.deltaY));
        },
        setAutoRefresh() {
            if (this.refreshTimer) clearInterval(this.refreshTimer);
            this.refreshTimer = setInterval(() => {
                this.loadSelection();
            }, 2 * 60 * 1000);
        },
        handleVideoClick(video) {
            this.$emit("videoClicked", video);
        },
        loadSelection(force) {
            if (!this.isActive) return;
            if (this.isUrl) return;
            this.isLoading = true;
            // Fetch live or archive depending on the right-column tab.
            const home = useHomeStore();
            const fetch = this.tab === 1 ? home.fetchArchive : home.fetchLive;
            Promise.resolve(fetch.call(home, { force })).finally(() => {
                this.isLoading = false;
            });
        },
        handlePicker(panel) {
            if (this.selectedPanel.name === panel.name) return;
            this.selectedPanel = panel;
            this.loadSelection(true);
            if (this.$refs.container) this.$refs.container.scrollTop = 0;
        },
    },
};
</script>

<style>
/* Title filter field. Fixed width so it does not collapse to its content width inside the flex container
   (in the top bar variant, the icon strip takes the remaining space). */
.title-filter-slim {
    flex: 0 0 auto;
    width: 220px;
}
.title-filter {
    flex: 0 0 auto;
    width: 280px;
}

.org-list {
    flex: 0 0 auto;
    min-height: 0px;
    overflow-y: auto;
    border-right: 1px solid rgba(127, 127, 127, 0.3);
}

.video-list {
    flex: 1 1 auto;
    min-height: 0px;
    overflow-y: auto;
}

.live-badge {
    position: absolute;
    bottom: 0;
    right: 0;
    z-index: 10;
    font-size: 12px;
    border-radius: 4px;
    padding: 0px 2px;
    /* Vuetify 2's global color classes (red/grey) are gone in Vuetify 3, so define the background and
       text colors ourselves. Upstream Holodex's red/grey set only the background; the text color
       followed the theme default (white in dark, roughly black in light). A fixed #fff differs from
       upstream in the light theme, so use the theme-aware on-background variable instead. */
    color: rgb(var(--v-theme-on-background));
}
.live-badge.is-live {
    background-color: #f44336; /* V2 red */
}
.live-badge.is-offline {
    background-color: #9e9e9e; /* V2 grey */
}

.refresh-spin {
    animation: spin 1.1s infinite linear;
}

.videos-bar::-webkit-scrollbar-track {
    background: rgba(99, 46, 46, 0.5);
}

.videos-bar::-webkit-scrollbar-thumb {
    background: #f06291a2;
}
</style>
