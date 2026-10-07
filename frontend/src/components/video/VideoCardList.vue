<template>
  <v-container
    class="py-0"
    style="position: relative"
    fluid
  >
    <!-- Video Card grid rows -->
    <div class="row video-row" :class="{'row--dense': dense || denseList || horizontal, 'video-row-list': denseList}">
      <!-- Video Cards with custom grid size class based on breakpoint -->
      <div
        v-for="(video, index) in processedVideos"
        :key="`${index}-${video.id}`"
        :class="['video-col', `video-${colSize}`, 'flex-column', 'col']"
      >
        <VideoCard
          :video="video"
          fluid
          :include-channel="includeChannel"
          :horizontal="horizontal"
          :include-avatar="includeAvatar"
          :col-size="colSize"
          :active="video.id === activeId"
          :disable-default-click="disableDefaultClick"
          :dense-list="denseList"
          :hide-thumbnail="shouldHideThumbnail"
          :in-multi-view-selector="inMultiViewSelector"
          @videoClicked="handleVideoClick"
        >
          <!-- pass slot to each individual video card -->
          <template #action>
            <slot name="action" :video="video" />
          </template>
        </VideoCard>
        <!-- Append comment item for Comment Search -->
        <v-list
          v-if="showComments && video.comments"
          style="max-height: 400px"
          density="compact"
          class="pa-0 transparent overflow-y-auto caption overflow-x-hidden"
        >
          <v-divider class="mx-4" style="flex-basis: 100%; height: 0" />
          <!-- Render Channel Avatar if necessary -->
          <v-list-item v-for="comment in video.comments" :key="comment.comment_key" class="pa-0">
            <comment :comment="comment" :video-id="video.id" />
          </v-list-item>
        </v-list>
      </div>
    </div>
  </v-container>
</template>

<script lang="ts">
import VideoCard from "@/components/video/VideoCard.vue";
import Comment from "./Comment.vue";
import filterVideos from "@/mixins/filterVideos";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";

export default {
    name: "VideoCardList",
    components: {
        VideoCard,
        Comment,
    },
    mixins: [filterVideos],
    props: {
        videos: {
            required: true,
            type: Array,
        },
        includeChannel: {
            required: false,
            type: Boolean,
        },
        includeAvatar: {
            required: false,
            type: Boolean,
        },
        hideThumbnail: {
            required: false,
            type: Boolean,
            default: false,
        },
        horizontal: {
            required: false,
            type: Boolean,
        },
        denseList: {
            required: false,
            type: Boolean,
        },
        cols: {
            type: Object,
            default: () => ({
                xs: 1,
                sm: 3,
                md: 4,
                lg: 6,
                xl: 8,
                xxl: 8,
            }),
        },
        activeId: { // TODO: seems never specified (and thus VideoCard.active always false)
            required: false,
            type: String,
            default: "",
        },
        dense: {
            type: Boolean,
            default: false,
        },
        disableDefaultClick: {
            type: Boolean,
            default: false,
        },
        filterConfig: {
            type: Object,
            default: () => {},
        },
        sortFn: {
            type: Function,
        },
        showComments: {
            type: Boolean,
            default: false,
        },
        inMultiViewSelector: {
            type: Boolean,
            required: false,
        },
    },
    computed: {
        processedVideos() {
            const config = {
                ...useSettingsStore().$state,
                ignoreBlock: false,
                hideCollabs: false,
                hideIgnoredTopics: true,
                hideGroups: this.includeChannel,
                forOrg: "",
                ...this.filterConfig,
            };
            const filtered = this.videos.filter((v) => this.filterVideos(v, config));
            return this.sortFn ? filtered.map(this.sortFn) : filtered;
        },
        colSize() {
            if (this.horizontal || this.denseList) return 1;
            return this.cols[this.$vuetify.display.name];
        },
        isMobile() {
            return useRootStore().isMobile;
        },
        shouldHideThumbnail() {
            return useSettingsStore().hideThumbnail || this.hideThumbnail;
        },
    },
    watch: {
        expanded() {
            // on close, set the scroll position back to the expand button
            if (!this.expanded) {
                this.$nextTick(() => {
                    this.$refs.expandBtn.$el.scrollIntoView({ block: "center" });
                });
            }
        },
    },
    methods: {
        handleVideoClick(video) {
            this.$emit("videoClicked", video);
        },
    },
};
</script>

<style lang="scss">
/* Vuetify 3 changed the flex behavior of .row/.col: a plain .row no longer lays out
   horizontally (flex-wrap) and stacks vertically instead. This grid sets its column widths
   itself via flex-basis, so set flex-wrap explicitly on the row container to reproduce the Vuetify 2 .row.
   Note: do not add width:100%. Combined with the negative margin of `.video-row.row{margin:0 -12px}`
     below, the row grows to 100%+24px and leaves too much space next to the rightmost card.
     The upstream Holodex (Vuetify 2) .row sets no width either; the negative margin alone offsets the outer cols' padding. */
.video-row {
    display: flex;
    flex-wrap: wrap;
}

.video-col {
    display: flex;
    justify-content: flex-start;
    box-sizing: border-box;
    padding: 12px; /* matches the Vuetify 2 .col gutter */

    &.video-1 {
        padding-left: 0px;
        padding-right: 0px;
        width: 100%;
        max-width: 100%;
        flex-basis: 100%;
    }

    &.video-2 {
        width: 50%;
        max-width: 50%;
        flex-basis: 50%;
    }

    &.video-3 {
        width: 33.3%;
        max-width: 33.3%;
        flex-basis: 33.3%;
    }

    &.video-4 {
        width: 25%;
        max-width: 25%;
        flex-basis: 25%;
    }

    &.video-5 {
        width: 20%;
        max-width: 20%;
        flex-basis: 20%;
    }

    &.video-6 {
        width: 16.666%;
        max-width: 16.666%;
        flex-basis: 16.666%;
    }

    &.video-7 {
        width: 14.285%;
        max-width: 14.285%;
        flex-basis: 14.285%;
    }

    &.video-8 {
        width: 12.5%;
        max-width: 12.5%;
        flex-basis: 12.5%;
    }

    &.video-12 {
        width: 8.33%;
        max-width: 8.33%;
        flex-basis: 8.33%;
    }
}
// Increase vertical padding to accomadate collab border
// Vuetify 3 renamed .col to .v-col, so a plain .col selector no longer matches.
// Target our own .video-col directly to reproduce upstream Holodex's dense gutter (6px 4px).
.video-row.row--dense > .video-col {
    padding: 6px 4px;
}

.video-row.row {
    margin: 0 -12px;
}

.video-row-list .video-col {
    border-bottom: 1px solid rgb(var(--v-theme-surface-light, var(--v-theme-surface)));
}
</style>
