<template>
  <div
    ref="fullscreen-content"
    :class="{ 'mobile-helpers': isMobile }"
    class="d-flex flex-column multiview"
  >
    <!-- Floating tool bar -->
    <MultiviewToolbar v-show="!collapseToolbar" v-model="collapseToolbar" :buttons="buttons">
      <template #left>
        <VideoSelector v-if="!$vuetify.display.xs" horizontal @videoClicked="handleToolbarClick" />
        <!-- Single Button video selector for xs displays -->
        <v-btn
          icon
          size="large"
          class="d-flex"
          @click="handleToolbarShowSelector"
        >
          <v-icon style="border-radius: 0; position: relative; margin-right: 3px; cursor: pointer" size="large">
            {{ mdiCardPlus }}
          </v-icon>
        </v-btn>
      </template>
      <template #buttons>
        <!-- Measured in the DOM, the upstream Holodex (Vuetify 2) <v-menu offset-y> opened to the
             right from near the activator's left edge (old: btn ~968 / menu 838-1388, with the
             right edge near the viewport edge). With "bottom end" or "bottom start", Vuetify 3's
             auto-flip at the screen edge opens it to the left instead (470-1020), the opposite of
             Vuetify 2. "bottom" (center), which opens below the activator's center, is the closest
             to Vuetify 2's slightly right-of-center position, so it is used here. -->
        <v-menu location="bottom">
          <template #activator="{ props }">
            <v-btn
              color="primary"
              theme="dark"
              v-bind="props"
              icon
            >
              <v-icon>{{ icons.mdiGridLarge }}</v-icon>
            </v-btn>
          </template>
          <!-- With Vuetify 3, a Teleport crashes on insertBefore(null) when its target (DOM inside the
               dialog) is created lazily, so separate instances are rendered instead: slim in the
               menu and full in the dialog. -->
          <preset-selector
            slim
            @selected="handlePresetClicked"
            @showAll="openPresetSelector"
          />
        </v-menu>
      </template>
    </MultiviewToolbar>
    <!-- Multiview Cell Area Background -->
    <!-- The background grid lines are drawn in the units that cells actually snap to (snapStep
         grid units). A coarser step gives larger squares, so the snap granularity is visible
         at a glance. -->
    <multiview-background
      :show-tips="layout.length === 0"
      :column-width="columnWidth"
      :row-height="rowHeight"
      :collapse-toolbar="collapseToolbar"
      :style="{
        // Cells are placed at colWidth*x + margin*(x+1), so the background lines are drawn with
        // one snap square = (colWidth + margin) * step and shifted by one margin to line up.
        'background-size':
          `${(columnWidth + GRID_MARGIN) * snapStep}px ${(rowHeight + GRID_MARGIN) * snapStep}px`,
        'background-position': `${GRID_MARGIN}px ${GRID_MARGIN}px`,
        height: `calc(100% - ${collapseToolbar ? 0 : 64}px - ${showSyncBar ? 100 : 0}px)`,
        top: `${collapseToolbar ? 0 : 64}px`,
      }"
    />
    <!-- Floating button to open toolbar when collapsed -->
    <v-btn
      v-if="collapseToolbar"
      class="open-mv-toolbar-btn"
      rounded="0"
      size="small"
      color="secondary"
      @click="collapseToolbar = false"
    >
      <v-icon>{{ icons.mdiChevronDown }}</v-icon>
    </v-btn>

    <!-- Grid Layout -->
    <!-- rowHeight/columnWidth already account for the margins (calculated in the computed
         properties), so the grid's total size fits the available area exactly, with no
         overflow or scrollbars.
         max-rows is left unset (default Infinity). 120x60 is the reference size that fits one
         screen without scrolling (rowHeight/columnWidth are based on 60 rows / 120 columns),
         not an upper limit; rows beyond 60 extend downward and scroll. The former
         :max-rows="GRID_ROWS", through the clamping in calcXY/calcWH combined with
         preventCollision, made cells that extended past the board impossible to move or resize. -->
    <grid-layout
      :layout="layout"
      :col-num="GRID_COLS"
      :row-height="rowHeight"
      :col-width="30"
      is-draggable
      is-resizable
      :vertical-compact="false"
      :prevent-collision="true"
      :margin="[GRID_MARGIN, GRID_MARGIN]"
      :snap-step="snapStep"
      @layout-updated="onLayoutUpdated"
    >
      <!-- This tells Vue not to try to re-order the elements but instead to create/delete them as required -->
      <TransitionGroup>
        <grid-item
          v-for="item in layout"
          :key="'mvitem' + item.i"
          :static="item.static"
          :x="item.x"
          :y="item.y"
          :w="item.w"
          :h="item.h"
          :i="item.i"
          :is-draggable="item.isDraggable !== false"
          :is-resizable="item.isResizable !== false"
          :style="showReorderLayout && {'pointer-events': 'none'}"
        >
          <cell-container :item="item">
            <ChatCell
              v-if="layoutContent[item.i] && layoutContent[item.i].type === 'chat'"
              :item="item"
              :cell-width="columnWidth * item.w"
              @delete="handleDelete"
            />
            <VideoCell
              v-else-if="layoutContent[item.i] && layoutContent[item.i].type === 'video'"
              ref="videoCell"
              :item="item"
              @delete="handleDelete"
            />
            <EmptyCell
              v-else
              :item="item"
              @showSelector="showSelectorForId = item.i"
              @delete="handleDelete"
            />
          </cell-container>
        </grid-item>
      </TransitionGroup>
    </grid-layout>

    <!-- Video Selector -->
    <v-dialog v-model="showVideoSelector" min-width="75vw" scrollable>
      <VideoSelector :is-active="showVideoSelector" @videoClicked="handleVideoClicked" />
    </v-dialog>

    <!-- Preset Selector (full view): the dialog renders its own full instance via v-if -->
    <!-- Measured in the DOM, Vuetify 3's v-dialog gets dialog-transition (fade + scale) by default
         (dialog-transition-enter-active was observed on .v-overlay__content). Upstream Holodex
         (Vuetify 2) set no transition either and used the default fade, so an explicit one is
         redundant and a source of inconsistency with the other dialogs. The explicit transition
         was removed so that every v-dialog uses the default fade, as in Vuetify 2. -->
    <v-dialog v-model="showPresetSelector" width="1000" scrollable>
      <preset-selector
        v-if="showPresetSelector"
        @selected="handlePresetClicked"
      />
    </v-dialog>

    <!-- Preset Editor -->
    <v-dialog v-model="showPresetEditor" scrollable>
      <PresetEditor
        v-if="showPresetEditor"
        :layout="layout"
        :content="layoutContent"
        @close="showPresetEditor = false"
      />
    </v-dialog>

    <LayoutChangePrompt
      v-model="overwriteDialog"
      :cancel-fn="overwriteCancel"
      :confirm-fn="overwriteConfirm"
      :default-overwrite="overwriteMerge"
      :layout-preview="overwriteLayoutPreview"
    />

    <v-dialog v-model="showReorderLayout" width="500" scrollable>
      <ReorderLayout :is-active="showReorderLayout" />
    </v-dialog>

    <media-controls v-model="showMediaControls" />
    <MultiviewSyncBar v-if="showSyncBar" class="mt-auto" />
  </div>
</template>

<script lang="ts">
import { GridLayout, GridItem } from "@/external/vue-grid-layout/src/components/index";
import MediaControls from "@/components/multiview/MediaControls.vue";
import MultiviewSyncBar from "@/components/multiview/MultiviewSyncBar.vue";
import EmptyCell from "@/components/multiview/EmptyCell.vue";
import VideoCell from "@/components/multiview/VideoCell.vue";
import ChatCell from "@/components/multiview/ChatCell.vue";
import CellContainer from "@/components/multiview/CellContainer.vue";
import PresetEditor from "@/components/multiview/PresetEditor.vue";
import PresetSelector from "@/components/multiview/PresetSelector.vue";
import MultiviewToolbar from "@/components/multiview/MultiviewToolbar.vue";
import MultiviewLayoutMixin from "@/components/multiview/MultiviewLayoutMixin";
import LayoutChangePrompt from "@/components/multiview/LayoutChangePrompt.vue";
import VideoSelector from "@/components/multiview/VideoSelector.vue";
import MultiviewBackground from "@/components/multiview/MultiviewBackground.vue";
import ReorderLayout from "@/components/multiview/ReorderLayout.vue";
import {
    mdiViewGridPlus, mdiCardPlus, mdiContentSave, mdiTuneVertical, mdiSync, mdiChatPlusOutline,
} from "@mdi/js";
import {
 decodeLayout, GRID_COLS, GRID_ROWS, GRID_MARGIN,
} from "@/utils/mv-utils";
import { siteTitle } from "@/utils/site";
import { mapState, mapGetters } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { TWITCH_VIDEO_URL_REGEX } from "@/utils/consts";

export const reorderIcon = "M2 2h8.8v8.8H2V2Zm11.3 11.3H22V22h-8.8v-8.8Zm4.6-10.9a.6.6 0 0 0-1 0l-3.9 4a.6.6 0 1 0 .9.9l3.5-3.6L21 7.3a.6.6 0 0 0 .8-1l-4-4Zm.1 10V2.8h-1.2v9.6H18ZM5.7 21.6c.3.3.7.3 1 0l3.9-4a.6.6 0 1 0-.9-.9l-3.5 3.6-3.6-3.6a.6.6 0 1 0-.9 1l4 4Zm-.2-10v9.6h1.3v-9.6H5.5Z";

export default {
    name: "MultiView",
    components: {
        GridLayout,
        GridItem,
        VideoSelector,
        PresetSelector,
        VideoCell,
        EmptyCell,
        ChatCell,
        PresetEditor,
        MultiviewToolbar,
        LayoutChangePrompt,
        CellContainer,
        MediaControls,
        MultiviewBackground,
        MultiviewSyncBar,
        ReorderLayout,
    },
    mixins: [MultiviewLayoutMixin],
    head() {
        const vm = this;
        return {
            get title() {
                return siteTitle(vm.$t("component.mainNav.multiview"));
            },
        };
    },
    data() {
        return {
            mdiCardPlus,
            mdiTuneVertical,
            mdiContentSave,

            // The grid's internal coordinate system (columns / rows / margin), referenced from the template.
            GRID_COLS,
            GRID_ROWS,
            GRID_MARGIN,

            showSelectorForId: -1,
            showSyncBar: false,
            showReorderLayout: false,
            overwriteDialog: false, // whether to show the overwrite dialog.
            overwriteCancel: null, // callbacks that will be generated when needed.
            overwriteConfirm: null, // callbacks to be generated when needed.
            overwriteMerge: false, // if the layout will be merged.
            overwriteLayoutPreview: {},

            collapseToolbar: false,

            showPresetSelectorMenu: false,
            showPresetSelector: false,
            showPresetEditor: false,
            showMediaControls: false,
        };
    },
    computed: {
        buttons() {
            return Object.freeze([
                {
                    icon: mdiViewGridPlus,
                    tooltip: this.$t("views.multiview.addframe"),
                    onClick: this.addCellAutoLayout,
                    color: "green",
                },
                {
                    icon: mdiTuneVertical,
                    tooltip: this.$t("views.multiview.mediaControls"),
                    color: "orange",
                    onClick: () => {
                        this.showMediaControls = !this.showMediaControls;
                    },
                },
                {
                    icon: reorderIcon,
                    onClick: () => {
                        this.showReorderLayout = !this.showReorderLayout;
                    },
                    color: "indigo lighten-1",
                    tooltip: this.$t("views.multiview.reorderLayout"),
                },
                {
                    icon: mdiSync,
                    onClick: this.toggleSyncBar,
                    color: "deep-purple lighten-2",
                    tooltip: this.$t("views.multiview.archiveSync"),
                    collapse: this.$vuetify.display.xs,
                },
                {
                    icon: mdiChatPlusOutline,
                    onClick: this.openChatPopout,
                    color: "teal",
                    tooltip: this.$t("views.multiview.popoutChat"),
                    collapse: this.$vuetify.display.smAndDown,
                },
                {
                    icon: mdiContentSave,
                    onClick: () => {
                        this.showPresetEditor = true;
                    },
                    tooltip: this.$t("views.multiview.presetEditor.title"),
                    color: "secondary",
                    collapse: this.$vuetify.display.mdAndDown,
                },
                {
                    icon: this.icons.mdiDelete,
                    tooltip: this.$t("component.music.clearPlaylist"),
                    onClick: this.clearAllItems,
                    color: "red",
                    collapse: this.$vuetify.display.smAndDown,
                },
                {
                    icon: this.icons.mdiFullscreen,
                    onClick: this.toggleFullScreen,
                    tooltip: this.$t("views.multiview.fullScreen"),
                    collapse: this.$vuetify.display.mdAndDown,
                },
            ]);
        },
        ...mapState("multiview", ["layout", "layoutContent", "presetLayout", "autoLayout"]),
        ...mapGetters("multiview", ["activeVideos", "snapStep"]),
        // Return true if there's an id requesting, setting false is setting id to -1
        showVideoSelector: {
            get() {
                return this.showSelectorForId !== -1;
            },
            set(open) {
                if (!open) this.showSelectorForId = -1;
            },
        },
        isMobile() {
            return useRootStore().isMobile;
        },
        rowHeight() {
            // Solve for rowHeight so that total height = rowHeight*GRID_ROWS + margin*(GRID_ROWS+1) equals the available height.
            const availH = this.$vuetify.display.height
                - (this.collapseToolbar ? 0 : 64)
                - (this.showSyncBar ? 100 : 0);
            return (availH - GRID_MARGIN * (GRID_ROWS + 1)) / GRID_ROWS;
        },
        columnWidth() {
            // Likewise, account for the margins so that the total width fits the available width exactly.
            const availW = this.$vuetify.display.width;
            return (availW - GRID_MARGIN * (GRID_COLS + 1)) / GRID_COLS;
        },
        videoRefs() {
            return this.$refs.videoCell;
        },
    },
    async mounted() {
        // Check if permalink layout is empty
        if (this.$route.params.layout) {
            // TODO: verify layout
            try {
                const parsed = decodeLayout(this.$route.params.layout);
                if (parsed.layout && parsed.content) {
                    // prompt overwrite with permalink, remove permalink if cancelled, use history.pushState for silent update
                    // eslint-disable-next-line no-restricted-globals
                    this.promptLayoutChange(parsed, null, () => history.pushState({}, "", "/multiview"));
                }
            } catch (e) {
                console.error(e);
                console.log("invalid layout");
            }

            // Show sync bar if query contains t= or offsets=
            if (this.$route.query.t || this.$route.query.offsets) {
                this.showSyncBar = true;
            }
        } else {
            this.mvStore.fetchVideoData({ refreshLive: true });
        }
    },
    methods: {
        // prompt user for layout change
        promptLayoutChange(layoutWithContent, confirmFunction, cancelFunction) {
            // a dialog is already active
            if (this.overwriteDialog) {
                return;
            }
            // no layout, overwrite without asking
            if (!this.layout || Object.keys(this.layout).length === 0) {
                this.setMultiview(layoutWithContent);
                return;
            }
            // show dialog with confirm or cancel functions
            this.overwriteLayoutPreview = layoutWithContent;
            this.overwriteConfirm = () => {
                // hide dialog
                this.overwriteDialog = false;
                this.setMultiview({
                    ...layoutWithContent,
                    mergeContent: this.overwriteMerge,
                });
                // call any extra functions
                confirmFunction && confirmFunction();
            };
            this.overwriteCancel = () => {
                this.overwriteDialog = false;
                cancelFunction && cancelFunction();
            };

            // show the dialog
            this.overwriteDialog = true;
        },
        handleToolbarClick(v) {
            const video = this.checkStreamType(v);
            if (!video) return;
            const hasEmptyCell = this.findEmptyCell();
            // more cells needed, increment to next preset with space
            if (!hasEmptyCell) {
                // Find new layout and set/prompt layout
                this.addVideoAutoLayout(video, (newLayout) => {
                    // User made edits to a preset, prompt them to overwrite
                    this.overwriteMerge = true;
                    this.promptLayoutChange(
                        newLayout,
                        // set new layout, and try to fill with video
                        () => {
                            this.tryFillVideo(video);
                        },
                    );
                });
            } else {
                // autolayout is not on, or there is an empty cell, just try filling
                this.tryFillVideo(video);
            }
        },
        handleVideoClicked(v) {
            if (this.showSelectorForId < -1) {
                this.handleToolbarClick(v);
                this.showSelectorForId = -1;
                return;
            }
            const video = this.checkStreamType(v);
            if (!video) return;
            this.addVideoWithId(video, this.showSelectorForId);
            this.showSelectorForId = -1;
        },
        handleToolbarShowSelector() {
            // Show selector and pass video to auto layout handler
            this.showSelectorForId = -2;
        },
        handlePresetClicked(preset) {
            this.showPresetSelector = false;
            this.setMultiview({
                ...JSON.parse(JSON.stringify(preset)),
                mergeContent: true,
            });
        },
        handleDelete(id) {
            this.deleteVideoAutoLayout(id);
        },
        openPresetSelector() {
            // The slim PresetSelector lives inside a v-menu, and clicking it closes the menu.
            // In Vue 3 the menu closing races with the dialog opening and the dialog fails to open,
            // so open it after the menu has fully closed ($nextTick is not enough; the next frame is reliable).
            requestAnimationFrame(() => {
                this.showPresetSelector = true;
            });
        },
        onLayoutUpdated(newLayout) {
            // Snap rounding is handled by snapStep, which is built into calcXY/calcWH of the forked
            // grid-layout, so this only saves the finalized layout.
            this.mvStore.setLayout(newLayout);
        },
        toggleFullScreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
            } else if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        },
        toggleSyncBar() {
            this.showSyncBar = !this.showSyncBar;
        },
        checkStreamType(v) {
            let video = v;
            // MultiView: for Twitch live streams, use the channel name as the id and set type=twitch
            if (video.channel?.platform === "twitch") {
                return {
                    ...video,
                    id: video.channel.id,
                    type: "twitch",
                };
            }
            if (video.type === "placeholder") {
                const twitchChannel = video.link?.match(TWITCH_VIDEO_URL_REGEX)?.groups.id;
                if (!twitchChannel) return video;
                video = {
                    ...video,
                    id: twitchChannel,
                    type: "twitch",
                };
            }
            return video;
        },
        // Opens the list of streams currently placed in video cells in a separate window
        // (chat-popout.html) with a chat switcher. The popout is same-origin, so the parent
        // condition matches the in-cell chat and the behavior does not change.
        // window.open's name is left empty so that every button press opens a new window.
        openChatPopout() {
            const videos = this.activeVideos;
            if (!videos || videos.length === 0) return;
            // Pass only the minimal fields chat-popout needs for switching.
            // Like VideoCell.isTwitchVideo, Twitch detection checks both type and platform
            // (after checkStreamType, type==="twitch" and id=channel.id (the login name), but
            //   some streams have no channel.platform, so checking only one would miss some).
            // The Twitch chat id is video.id (the login name), the same value VideoCell passes to :channel.
            const list = videos.map((video) => {
                const isTwitch = video.type === "twitch" || video.channel?.platform === "twitch";
                if (isTwitch) {
                    return {
                        platform: "twitch",
                        chatId: video.id,
                        name: video.channel?.name ?? video.id,
                    };
                }
                return {
                    platform: "youtube",
                    videoId: video.id,
                    name: video.channel?.name ?? video.title,
                    // Chat replay cannot be embedded for archives (same check as ChatCell.chatUnavailable).
                    // The popout uses this flag to show a notice instead of the iframe.
                    archived: !!video.status && video.status !== "live" && video.status !== "upcoming",
                };
            });
            const params = new URLSearchParams({
                parent: window.location.hostname,
                dark: useSettingsStore().darkMode ? "1" : "0",
                lang: useSettingsStore().lang,
                sel: "0",
                list: JSON.stringify(list),
            });
            // With popup specified, the browser opens a minimal popup window without a URL bar
            // or toolbar. The empty name opens a new window every time (several can be open at once).
            window.open(`/chat-popout.html?${params.toString()}`, "", "popup,width=420,height=720");
        },
    },
};
</script>

<style lang="scss">
.multiview {
    width: 100%;
    height: 100%;
}
.mobile-helpers {
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
    // margin-bottom: env(safe-area-inset-bottom);
    .edit-mode {
        padding: 5px;
        padding-bottom: 20px;
    }
}
.open-mv-toolbar-btn {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 10;
    opacity: 0.5;
}
.vue-grid-item {
    transition: none;
}

.vue-grid-layout {
    transition: none;
}

.hints {
    div {
        margin-bottom: 10px;
    }
}
</style>
