<template>
  <v-card v-if="!slim" style="min-height: 90vh">
    <v-card-title>{{ $t("views.multiview.presets") }}</v-card-title>
    <v-card-text>
      <v-tabs v-model="currentTab" class="mb-2">
        <v-tab>{{ $t("views.multiview.preset.desktop") }}</v-tab>
        <v-tab>{{ $t("views.multiview.preset.custom") }}</v-tab>
        <v-tab>{{ $t("views.multiview.preset.mobile") }}</v-tab>
      </v-tabs>
      <div v-if="currentTab === 0">
        <v-btn :color="editAutoLayout ? 'primary' : ''" @click="editAutoLayout = !editAutoLayout">
          <v-icon start>
            {{ editAutoLayout ? icons.mdiCheck : icons.mdiPencil }}
          </v-icon>
          {{ editAutoLayout ? $t("views.multiview.done") : $t("views.multiview.editAutoLayout") }}
        </v-btn>
        <v-btn
          v-if="editAutoLayout"
          color="orange"
          class="ml-1"
          @click="resetAutoLayout"
        >
          <v-icon start>
            {{ icons.mdiRefresh }}
          </v-icon>
          {{ $t("views.library.selectionReset") }}
        </v-btn>
        <template v-for="(group, index) in desktopGroups" :key="'preset-' + index">
          <v-radio-group
            :model-value="autoLayout[index] || 'None'"
            column
            hide-details
            class="ma-0"
          >
            <v-card-subtitle v-if="index !== 0" class="text-body-1 pa-1">
              {{ $t("component.channelInfo.videoCount", [index]) }}
            </v-card-subtitle>
            <v-row v-if="group" :key="'desktop-' + index">
              <v-col v-if="editAutoLayout" cols="auto" class="pa-1">
                <LayoutPreviewCard
                  :preset="{ layout: '', content: {} }"
                >
                  <template #pre>
                    <v-radio
                      v-show="editAutoLayout"
                      label="None"
                      value="None"
                      class="ma-0"
                      @click="setAutoLayout(index, null)"
                    />
                  </template>
                </LayoutPreviewCard>
              </v-col>
              <template v-for="preset in group" :key="preset.name">
                <v-col cols="auto" class="pa-1">
                  <LayoutPreviewCard
                    v-if="!showCustom || (showCustom && preset.custom)"
                    :preset="preset"
                    :active="presetInAuto(preset)"
                    @click="editAutoLayout ? setAutoLayout(index, preset.id) : handleSelected(preset)"
                  >
                    <template #pre>
                      <v-radio
                        v-show="editAutoLayout"
                        label=""
                        :value="preset.id"
                        class="ma-0"
                      />
                    </template>
                    <template v-if="preset.custom" #post>
                      <v-menu location="bottom">
                        <template #activator="{ props }">
                          <v-icon style="position: absolute; right: 0;" v-bind="props" @click.stop.prevent>
                            {{ icons.mdiDotsVertical }}
                          </v-icon>
                        </template>
                        <v-list density="compact">
                          <v-list-item @click.stop="removePresetLayout(preset)">
                            <v-icon start>
                              {{ icons.mdiDelete }}
                            </v-icon>
                            {{ $t("views.multiview.preset.remove") }}
                          </v-list-item>
                        </v-list>
                      </v-menu>
                    </template>
                  </LayoutPreviewCard>
                </v-col>
              </template>
            </v-row>
          </v-radio-group>
        </template>
      </div>
      <v-row v-else-if="currentTab === 1">
        <template v-for="preset in decodedCustomPresets" :key="preset.name">
          <v-col cols="auto" class="d-flex flex-column align-center">
            <LayoutPreviewCard
              :preset="preset"
              :active="presetInAuto(preset)"
              @click="handleSelected(preset)"
            />
          </v-col>
        </template>
      </v-row>
      <v-row v-else-if="currentTab === 2" justify="space-around" align="center">
        <template v-for="preset in decodedMobilePresets" :key="preset.name">
          <v-col cols="auto" class="d-flex flex-column align-center">
            <LayoutPreviewCard
              :preset="preset"
              :active="presetInAuto(preset)"
              @click="handleSelected(preset)"
            />
          </v-col>
        </template>
      </v-row>
    </v-card-text>
  </v-card>
  <v-sheet v-else class="pa-2 preset-menu">
    <div class="text-body-1 d-flex justify-space-between align-center">
      <span class="px-4">{{ $t("views.multiview.changeLayout") }}</span>
      <v-btn variant="text" @click="$emit('showAll')">
        {{ $t("views.favorites.showall") }}
      </v-btn>
    </div>
    <!-- Snap granularity for grid editing. The internal coordinates (120×60) do not change; only the
         rounding unit (how coarse the steps are) does. Left end = coarse … right end = fine. The slider
         picks the step. -->
    <div class="d-flex align-center px-4 pb-1">
      <span class="text-caption text-medium-emphasis mr-2">{{ $t("views.multiview.gridSnap.label") }}</span>
      <v-icon size="x-small" class="mr-1">{{ mdiViewGridOutline }}</v-icon>
      <v-slider
        :model-value="sliderSnapIndex"
        :min="0"
        :max="snapSteps.length - 1"
        :step="1"
        show-ticks="always"
        tick-size="3"
        density="compact"
        hide-details
        color="primary"
        class="grid-snap-slider"
        style="max-width: 160px"
        @update:model-value="previewSnapIndex = $event"
        @end="setSnapIndex"
      />
      <v-icon size="small" class="ml-1">{{ mdiViewGrid }}</v-icon>
      <span class="text-caption text-medium-emphasis ml-2" style="min-width: 48px">{{ gridDivisions }}</span>
    </div>
    <v-row class="ml-1">
      <template v-for="preset in currentGroup" :key="preset.name">
        <v-col cols="auto" class="justify-center pa-1">
          <LayoutPreviewCard
            :scale="0.8"
            :preset="preset"
            :active="presetInAuto(preset)"
            @click="handleSelected(preset)"
          />
        </v-col>
      </template>
    </v-row>
  </v-sheet>
</template>

<script lang="ts">
import { mdiDotsVertical, mdiToggleSwitch, mdiViewGrid, mdiViewGridOutline } from "@mdi/js";
import {
    decodeLayout, SNAP_STEPS, GRID_COLS, GRID_ROWS,
} from "@/utils/mv-utils";
import { mapState, mapGetters } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useMultiviewStore } from "@/store/multiview.store";
import LayoutPreviewCard from "./LayoutPreviewCard.vue";

export default {
    name: "PresetSelector",
    components: {
        LayoutPreviewCard,
    },
    props: {
        slim: {
            type: Boolean,
        },
    },
    data() {
        return {
            mdiDotsVertical,
            mdiToggleSwitch,
            mdiViewGrid,
            mdiViewGridOutline,
            currentTab: 0,
            editAutoLayout: false,
            showCustom: false,
            snapSteps: SNAP_STEPS,
            // Temporary value so the division count display follows the slider while dragging (null = use the committed value).
            previewSnapIndex: null,
        };
    },
    computed: {
        ...mapState("multiview", ["presetLayout", "autoLayout", "activeVideos", "layout", "layoutContent", "snapIndex"]),
        ...mapGetters("multiview", [
            "decodedCustomPresets",
            "decodedMobilePresets",
            "desktopGroups",
            "activeVideos",
        ]),
        // Value shown by the slider. previewSnapIndex takes priority while dragging.
        // Note: binding :model-value to the committed value (snapIndex) pulls the thumb back to its
        //   original position on every flush during a drag, making it feel stuck, so follow the preview value.
        sliderSnapIndex() {
            return this.previewSnapIndex != null ? this.previewSnapIndex : this.snapIndex;
        },
        // Number of divisions at the current precision (columns×rows). Follows previewSnapIndex while dragging.
        gridDivisions() {
            const idx = this.previewSnapIndex != null ? this.previewSnapIndex : this.snapIndex;
            const step = SNAP_STEPS[idx] ?? SNAP_STEPS[SNAP_STEPS.length - 1];
            return `${GRID_COLS / step}×${GRID_ROWS / step}`;
        },
        autoLayoutSet() {
            return new Set(this.autoLayout);
        },
        totalVideoCells() {
            return this.layout.filter((l) => !this.layoutContent[l.i] || this.layoutContent[l.i].type !== "chat").length;
        },
        currentGroup() {
            if (useRootStore().isMobile) return this.decodedMobilePresets;
            const layouts = (this.activeVideos.length < this.desktopGroups.length) && this.desktopGroups[this.activeVideos.length];
            return layouts || this.desktopGroups[1];
        },
    },
    methods: {
        resetAutoLayout() {
            useMultiviewStore().resetAutoLayout();
        },
        setAutoLayout(index, encodedLayout) {
            useMultiviewStore().setAutoLayout({ index, encodedLayout });
        },
        setSnapIndex(index) {
            useMultiviewStore().setSnapIndex(index);
            // Once committed, clear the preview value so gridDivisions goes back to the committed value (snapIndex).
            // (Otherwise it would keep reading previewSnapIndex forever and stop following external changes.)
            this.previewSnapIndex = null;
        },
        decodeLayout,
        handleSelected(preset) {
            this.$emit("selected", preset);
        },
        removePresetLayout(preset) {
            const presetIdx = this.autoLayout.findIndex((l) => l === preset.id);
            if (presetIdx >= 0) this.setAutoLayout(presetIdx, null);
            useMultiviewStore().removePresetLayout(preset.name);
        },
        presetInAuto(preset) {
            return this.autoLayoutSet.has(preset.id);
        },
    },
};
</script>

<style>
.is-auto-layout {
    color: rgb(var(--v-theme-primary));
}

.preset-menu {
  max-width: 550px;
  width: 80vw;
  max-height: 90vh;
  overflow-y: auto;
  /* The inner v-row (negative-margin gutter) sticks out about 4px at the bottom right, and in Vuetify 3
     overflow-x gets overridden to auto, so scrollbars kept appearing and disappearing on both axes
     (Vuetify 2 had scrollHeight = clientHeight and none at all). Clip the overflowing v-row and pin
     overflow-x to hidden with !important. */
  overflow-x: hidden !important;
}
/* Keep the v-row's negative margin (-12px) plus ml-1 from overflowing preset-menu's bottom right by 4px */
.preset-menu > .v-row {
  margin: 0 !important;
}
/* Upstream Holodex (Vuetify 2) used a dense slider (thin track/thumb). Vuetify 3's density="compact"
   has a thick track/thumb, so slim them the same way as ChannelRow. */
.grid-snap-slider .v-slider-track__background,
.grid-snap-slider .v-slider-track__fill {
  height: 2px !important;
}
.grid-snap-slider .v-slider-track {
  --v-slider-track-size: 2px;
}
.grid-snap-slider .v-slider-thumb__surface {
  width: 12px;
  height: 12px;
}
.grid-snap-slider .v-slider-thumb {
  --v-slider-thumb-size: 12px;
}
/* Keep scrollbars from appearing and disappearing on the v-menu wrapper (.v-overlay__content).
   preset-menu manages overflow itself, so the Vuetify 3 overlay content does not clip. */
.v-overlay__content:has(> .preset-menu) {
  overflow: visible;
}
</style>
