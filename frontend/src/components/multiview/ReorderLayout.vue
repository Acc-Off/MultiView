<template>
  <v-card v-if="isActive">
    <v-card-title> {{ $t("views.multiview.reorderLayout") }} </v-card-title>
    <v-card-text>
      {{ $t("views.multiview.reorderLayoutDetail") }}
      <div
        ref="container"
        class="layout-preview ma-auto mt-2"
        :class="{ 'theme--light': !$vuetify.theme.global.current.dark }"
        :style=" {
          width: `${size.width}px`,
          height: `${size.height}px`,
        }"
      >
        <template v-for="(l, idx) in layout" :key="l.i">
          <div
            class="layout-preview-cell"
            :style="getStyle(l)"
            @dragover="onDragOver"
            @drop="onDrop($event, idx)"
          >
            <!-- Why reordering did not work: Vue 3 renders the boolean attribute `draggable` as
                 `draggable=""`, and draggable, being an enumerated attribute, treats anything other than
                 "true" as false, so native drag and drop never starts (measured in the DOM: Vue 3 gives
                 draggable=""/prop=false, Vue 2 gave draggable="true"/prop=true).
                 Set the string "true" explicitly to make it draggable as in Vue 2. -->
            <div
              v-if="content && content[l.i]"
              draggable="true"
              class="pa-3 grabbable"
              :style="{
                opacity: draggingIdx !== idx ? 1 : 0
              }"
              @dragstart="onDragStart($event, idx)"
              @touchstart="onTouchStart($event, idx)"
              @touchend="onTouchEnd($event, idx)"
              @touchmove="onTouchMove($event, idx)"
              @touchcancel="draggingIdx = -1"
            >
              <v-icon v-if="content[l.i].type === 'chat'" size="large">
                {{ icons.ytChat }}
              </v-icon>
              <!-- Show the real channel icon for Twitch too. Upstream Holodex had no way to fetch Twitch
                   icons and substituted the mdiTwitch logo, but this app holds the real icons in a
                   dictionary (login=id), so use ChannelImg for both (same as YouTube). -->
              <channel-img
                v-else-if="content[l.i].type === 'video'"
                :channel="content[l.i].video.channel"
                rounded
              />
            </div>
          </div>
        </template>
        <div
          v-if="draggingIdx >= 0"
          style="position: absolute; touch-action: none"
          :style="draggableIconPos"
        >
          <v-icon v-if="touchMoveContent.type === 'chat'" size="large">
            {{ icons.ytChat }}
          </v-icon>
          <!-- Real icon via ChannelImg for Twitch too (same reason as in the grid above). -->
          <channel-img
            v-else-if="touchMoveContent.type === 'video'"
            :channel="touchMoveContent.video.channel"
            rounded
          />
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { mapState } from "@/store/helpers";
import { useMultiviewStore } from "@/store/multiview.store";
import { GRID_COLS, GRID_ROWS } from "@/utils/mv-utils";
import ChannelImg from "../channel/ChannelImg.vue";

export default {
    name: "RearrangeVideos",
    components: { ChannelImg },
    props: {
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    data() {
        return {
            draggableIconPos: {
                left: 0,
                top: 0,
            },
            draggingIdx: -1,
        };
    },
    computed: {
        ...mapState("multiview", ["layout"]),
        ...mapState("multiview", { content: "layoutContent" }),
        touchMoveContent() {
            if (this.draggingIdx >= 0) return this.content[this.layout[this.draggingIdx].i];
            return null;
        },
        size() {
            // The preview frame matches the grid ratio (GRID_COLS:GRID_ROWS = 120:60 = 2:1).
            // It used to be 16:9 (384×216) or similar, which, together with the hard-coded 24 in getStyle,
            // pushed cells outside the frame.
            const width = this.$vuetify.display.xs ? 288 : 384;
            const height = width * (GRID_ROWS / GRID_COLS);
            return { width, height };
        },
    },
    methods: {
        onTouchStart(e, idx) {
            e.preventDefault();
            this.draggingIdx = idx;
            this.onTouchMove(e);
        },
        onTouchMove(e) {
            e.preventDefault();
            const { x, y } = this.getRelativePoint(e.changedTouches[0]);
            this.draggableIconPos.left = `${x}px`;
            this.draggableIconPos.top = `${y}px`;
        },
        onTouchEnd(e, startIdx) {
            e.preventDefault();
            // x & y are relative to the clicked element
            const { x, y } = this.getRelativePoint(e.changedTouches[0]);
            const { width, height } = this.size;
            // The grid is 120×60 (GRID_COLS/GRID_ROWS). This used to be hard-coded as 24×24, so the drop
            // target cell was detected wrongly (the 24-to-120 conversion was missed here). Scale by the constants.
            const unitX = x / (width / GRID_COLS);
            const unitY = y / (height / GRID_ROWS);
            // Find intersecting cell
            const dropCellIdx = this.layout.findIndex((l) => unitX >= l.x && unitX < (l.x + l.w) && unitY >= l.y && unitY < (l.y + l.h));
            if (dropCellIdx !== undefined) {
                useMultiviewStore().swapGridPosition({ id1: startIdx, id2: dropCellIdx });
            }
            this.draggingIdx = -1;
        },
        onDragStart(e, idx) {
            e.dataTransfer.setData("index", idx);
        },
        onDragOver(e) {
            e.preventDefault();
        },
        onDrop(e, dropIdx) {
            e.preventDefault();
            const startIdx = e.dataTransfer.getData("index");
            useMultiviewStore().swapGridPosition({ id1: startIdx, id2: dropIdx });
        },
        getRelativePoint(touch) {
            const br = this.$refs.container.getBoundingClientRect();
            // x & y are relative to the clicked element
            const x = touch.clientX - br.left;
            const y = touch.clientY - br.top;
            return { x, y };
        },
        getStyle(l) {
            // The grid is 120 columns × 60 rows (GRID_COLS/GRID_ROWS). With the old hard-coded 24,
            // x=60 became 250% and the right-hand cells flew outside the frame (the cause of the broken preview).
            // Convert to percentages with GRID_COLS horizontally and GRID_ROWS vertically.
            const pxX = (num) => `${num * (100 / GRID_COLS)}%`;
            const pxY = (num) => `${num * (100 / GRID_ROWS)}%`;
            return {
                top: pxY(l.y),
                left: pxX(l.x),
                width: pxX(l.w),
                height: pxY(l.h),
                // Vuetify 3: colors live at theme.current.colors.<name> (hex; the old parsedTheme.X.base is gone).
                ...(this.content && this.content[l.i] && this.content[l.i].type === "chat"
                    ? { "background-color": `${this.$vuetify.theme.current.colors.warning}44` }
                    : { "background-color": `${this.$vuetify.theme.current.colors.info}44` }),
            };
        },
    },
};
</script>
<style>
.grabbable, .grabbable *, .grabbable *:hover, .grabbable *:active {
    cursor: move !important; /* fallback if grab cursor is unsupported */
}
</style>
