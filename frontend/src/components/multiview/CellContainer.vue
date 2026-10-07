<template>
  <v-sheet
    class="mv-cell"
    rounded
    :class="{
      'edit-mode': editMode,
    }"
    @drop="drop"
    @dragover="allowDrop"
    @dragleave="dragLeave"
    @dragenter="dragEnter"
  >
    <!-- Drop Overlay: marks the drop target during drag and drop.
         Vuetify 3's v-overlay defaults to locationStrategy 'static' (a TODO implementation that sets no
         top/left on the content), so .v-overlay__content (position:absolute) sticks to (0,0), the cell's
         top-left corner (Vuetify 2 centered it). A dedicated class centers the content in the cell
         explicitly, matching Vuetify 2. -->
    <v-overlay contained :model-value="showDropOverlay" class="drop-overlay">
      <div>
        <v-icon size="x-large">
          {{ mdiSelectionEllipseArrowInside }}
        </v-icon>
      </div>
    </v-overlay>
    <!-- Actual cell content -->
    <slot />
    <!-- Edit mode size info -->
    <div v-if="editMode" class="dimensions text-body-1">
      {{ item.w }} x {{ item.h }}
    </div>
  </v-sheet>
</template>

<script lang="ts">
import { getVideoIDFromUrl } from "@/utils/functions";
import { useMultiviewStore } from "@/store/multiview.store";
import {
    mdiSelectionEllipseArrowInside,
} from "@mdi/js";
import { TWITCH_VIDEO_URL_REGEX } from "@/utils/consts";

export default {
    props: {
        item: {
            type: Object,
            required: true,
        },
        index: {
            type: Number,
            default: -1,
        },
    },
    data() {
        return {
            showDropOverlay: false,
            enterTarget: null,
            mdiSelectionEllipseArrowInside,
        };
    },
    computed: {
        mvStore() {
            return useMultiviewStore();
        },
        editMode() {
            return this.mvStore.layoutContent[this.item.i]?.editMode ?? true;
        },
    },
    watch: {
        editMode(newMode) {
            this.setLayoutFreeze(newMode);
        },
    },
    methods: {
        setLayoutFreeze(newMode = this.editMode) {
            if (newMode) this.mvStore.unfreezeLayoutItem(this.item.i);
            else this.mvStore.freezeLayoutItem(this.item.i);
        },
        dragEnter(ev) {
            this.enterTarget = ev.target;
            this.showDropOverlay = true;
        },
        dragLeave(ev) {
            if (this.enterTarget === ev.target) {
                this.showDropOverlay = false;
            }
        },
        allowDrop(ev) {
            ev.preventDefault();
        },
        drop(ev) {
            ev.preventDefault();
            this.showDropOverlay = false;
            // Parse content in dataTransfer object, and insert video
            const json: string = ev.dataTransfer.getData("application/json");
            if (json) {
                const video = JSON.parse(json);

                // Twitch uses the channel login name as the id, so its length varies (unlike YouTube's fixed
                // 11-character video IDs; only channels with an 11-character login happened to pass). Branch on
                // the type and place Twitch videos without the id.length check, putting the video in as is,
                // the same way the click-to-add path does.
                const isTwitch = video.channel?.platform === "twitch" || video.type === "twitch";
                if ((isTwitch && video.id && video.channel?.name) || (video.id.length === 11 && video.channel.name)) {
                    let v = video;
                    if (video.type === "placeholder") {
                        const twitchChannel = video.link.match(TWITCH_VIDEO_URL_REGEX)?.groups.id;
                        if (!twitchChannel) return;
                        v = {
                            ...video,
                            id: twitchChannel,
                            type: "twitch",
                        };
                    }
                    this.mvStore.setLayoutContentById({
                        id: this.item.i,
                        content: {
                            type: "video",
                            id: v.id,
                            video: v,
                        },
                    });
                    this.mvStore.fetchVideoData();
                }
                return;
            }

            const text: string = ev.dataTransfer.getData("text");
            const video = getVideoIDFromUrl(text);
            if (!video || !video.id) return;

            this.mvStore.setLayoutContentById({
                id: this.item.i,
                content: {
                    id: video.id,
                    type: "video",
                    video,
                },
            });
            this.mvStore.fetchVideoData();
        },
    },
};
</script>

<style lang="scss">
.mv-cell {
    display: flex;
    background-size: contain;
    background-position: center;
    height: 100%;
    border: 1px solid #f0629118 !important;
    justify-content: flex-start;
    align-content: stretch;
    flex-direction: column;

    .cell-content {
        display: flex;
        flex-grow: 1;
        flex-basis: 100%;
        flex-shrink: 1;
        max-height: 100%;
        height: 100%;
        width: 100%;
        flex-direction: column;
    }

    .dimensions {
        position: absolute;
        bottom: 0;
        right: 18px;
    }
}

/* Center the Drop Overlay marker in the cell. Vuetify 3's static locationStrategy gives the content no
   top/left, so the position:absolute content ends up at the top-left. Center it explicitly. */
.drop-overlay .v-overlay__content {
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
}
/* Vuetify 2 had .v-overlay{color:#fff}, so icons inside an overlay were always white regardless of theme.
   Vuetify 3's v-overlay has no such rule and inherits the theme's text color: still white in dark mode,
   but black in light mode, where it is hard to see against the dark scrim.
   Pin it to white at all times, as in Vuetify 2. */
.drop-overlay .v-overlay__content .v-icon {
    color: #fff !important;
}

.mv-cell.edit-mode {
    border: 1px solid rgb(var(--v-theme-secondary)) !important;
    padding: 20px;
}

.vue-grid-item.vue-draggable-dragging .mv-cell,
.vue-grid-item.resizing .mv-cell {
    pointer-events: none;
}

</style>
