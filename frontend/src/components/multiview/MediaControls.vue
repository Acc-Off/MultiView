<template>
  <v-dialog :model-value="value" max-width="600" scroll-strategy="none" @update:model-value="$emit('update:modelValue', $event)">
    <v-card max-height="75vh" class="overflow-y-auto">
      <v-card-title class="mc-title-bar"> {{ $t("views.multiview.mediaControls") }} </v-card-title>
      <v-card-text class="mc-card-text d-flex flex-column justify-center align-center">
        <v-list width="100%" max-width="100%" class="media-controls-list">
          <v-list-item class="mc-all-row">
            <div class="v-list-item__content">
              <div class="mc-btn-row d-flex flex-row justify-center align-center ma-0">
                <v-btn icon @click="allCellAction('play')">
                  <v-icon color="secondary-lighten-1">
                    {{ icons.mdiPlay }}
                  </v-icon>
                </v-btn>
                <v-btn icon title="Sync" @click="allCellAction('sync')">
                  <v-icon color="secondary-lighten-1">
                    {{ mdiFastForward }}
                  </v-icon>
                </v-btn>
                <v-btn icon @click="allCellAction('pause')">
                  <v-icon color="secondary-lighten-1">
                    {{ mdiPause }}
                  </v-icon>
                </v-btn>
                <v-btn icon @click="allCellAction('refresh')">
                  <v-icon color="secondary-lighten-1">
                    {{ icons.mdiRefresh }}
                  </v-icon>
                </v-btn>
                <v-btn icon @click="allCellAction('unmute')">
                  <v-icon color="secondary-lighten-1">
                    {{ icons.mdiVolumeHigh }}
                  </v-icon>
                </v-btn>
                <v-btn icon @click="allCellAction('mute')">
                  <v-icon color="secondary-lighten-1">
                    {{ icons.mdiVolumeMute }}
                  </v-icon>
                </v-btn>
                <v-spacer />
                <v-slider
                  class="volume-slider"
                  :model-value="allVolume"
                  :max="100"
                  :min="0"
                  :step="1"
                  :color="allVolume === 0 ? 'gray' : 'secondary'"
                  density="compact"
                  hide-details
                  @update:model-value="setAllVolume"
                />
                <span class="mc-volume-label text-caption text-medium-emphasis">
                  {{ Math.round(allVolume) }}
                </span>
              </div>
            </div>
          </v-list-item>
          <template v-if="value && $parent.$refs.videoCell && $parent.$refs.videoCell.length">
            <div
              v-for="(cellState, index) in cells"
              :key="index"
              class="mc-row d-flex flex-row align-center"
            >
              <div class="mc-avatar ma-0 mr-2">
                <ChannelImg :channel="cellState.video.channel" :size="40" />
              </div>
              <div class="mc-content flex-grow-1">
                <div class="mc-channel text-primary">
                  {{ cellState.video.channel.name }}
                </div>
                <div v-if="cellState.video.title" class="mc-title">
                  {{ cellState.video.title }}
                </div>
                <div class="mc-btn-row d-flex flex-row justify-start align-center ma-0 mt-1">
                  <v-btn icon @click="cellState.setPlaying(cellState.editMode)">
                    <v-icon color="grey-lighten-1">
                      {{ cellState.editMode ? icons.mdiPlay : mdiPause }}
                    </v-icon>
                  </v-btn>
                  <v-btn
                    v-if="!cellState.isTwitchVideo"
                    icon
                    @click="cellState.togglePlaybackRate()"
                  >
                    <v-icon :color="cellState.isFastFoward ? 'primary' :'grey' ">
                      {{ mdiFastForward }}
                    </v-icon>
                  </v-btn>
                  <v-btn icon @click="cellState.refresh()">
                    <v-icon color="grey-lighten-1">
                      {{ icons.mdiRefresh }}
                    </v-icon>
                  </v-btn>
                  <v-btn icon @click="cellState.deleteCell()">
                    <v-icon color="grey-lighten-1">
                      {{ icons.mdiDelete }}
                    </v-icon>
                  </v-btn>
                  <v-btn icon @click="cellState.setMuted(!cellState.muted)">
                    <v-icon color="grey-lighten-1">
                      {{ cellState.muted ? icons.mdiVolumeMute : icons.mdiVolumeHigh }}
                    </v-icon>
                  </v-btn>
                  <v-spacer />
                  <v-slider :model-value="cellState.volume" :max="100" :min="0" :step="1" class="volume-slider" density="compact" hide-details @update:model-value="cellState.setVolume($event)" />
                  <span class="mc-volume-label text-caption text-medium-emphasis">
                    {{ Math.round(cellState.volume) }}
                  </span>
                </div>
              </div>
            </div>
          </template>
          <v-list-item v-else class="pa-2 justify-center">
            {{ $t("views.multiview.mediaControlsEmpty") }}
          </v-list-item>
          <v-list-item class="mc-switch-row" style="border: none">
            <v-switch
              v-model="muteOthers"
              color="primary"
              :label="$t('views.multiview.muteOthers')"
              :hint="$t('views.multiview.muteOthersDetail')"
              persistent-hint
            />
          </v-list-item>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import {
    mdiPause, mdiFastForward,
} from "@mdi/js";
import { mapState, mapGetters } from "@/store/helpers";
import { syncState } from "@/utils/functions";
import ChannelImg from "@/components/channel/ChannelImg.vue";

export default {
    name: "MediaControls",
    components: { ChannelImg },
    // Vue 3's v-model uses modelValue/update:modelValue. The parent still uses <media-controls v-model="...">.
    props: {
        modelValue: {
            type: Boolean,
        },
    },
    emits: ["update:modelValue"],
    data() {
        return {
            mdiPause,
            mdiFastForward,
            timer: null,
            mounted: false,
        };
    },
    computed: {
        ...syncState("multiview", ["muteOthers"]),
        ...mapGetters("multiview", ["activeVideos"]),
        ...mapState("multiview", ["layoutContent"]),
        // Keep value, which the existing template/watch refer to, as an alias of modelValue.
        value() {
            return this.modelValue;
        },
        allVolume() {
            const cells = this.$parent.$refs.videoCell;
            if (!this.mounted || !this.value || !cells || !cells.length) return 0;
            // Check if all volume is the same, else return 0
            const vol = cells[0].volume;
            return cells.every((c) => c.volume === vol) ? vol : 0;
        },
        cells() {
            // Bind the cell ref recompute to value/activeVideos
            // Reason: refs are not observable, therefore changes are not propogated up
            // Also depend on each muted in layoutContent. VideoCell's muted returns the store's
            // layoutContent[i].muted, but when read through a ref, a muted change did not
            // recompute this computed, so the row mute icons / mute-all button did not follow
            // the actual state (audio was right, only the display was stale). Subscribe to
            // layoutContent so cells is re-evaluated on every muted change and the template re-reads the refs.
            const mutedDeps = Object.values(this.layoutContent).map((c) => c?.muted).join(",");
            // Right after restoring from a shared URL, each cell's channel.id/handle is not yet known and is
            // filled in later by the oembed backfill / Twitch resolution. cells goes through $refs
            // (non-reactive), so it is not re-evaluated when channel changes; the row's ChannelImg kept
            // receiving the stale channel (no id/handle) and stayed stuck on the default icon. Depend on
            // each channel.id/handle in layoutContent so cells is re-evaluated whenever they are filled in
            // and the template re-reads the latest channel.
            const channelDeps = Object.values(this.layoutContent)
                .map((c) => `${c?.video?.channel?.id ?? ""}:${c?.video?.channel?.handle ?? ""}`).join(",");
            const alwaysTrue = this.value || !this.value || this.activeVideos || mutedDeps || channelDeps;
            if (!this.$parent?.$refs?.videoCell) return [];
            return alwaysTrue && this.$parent.$refs.videoCell.filter((c) => c.video);
        },
        uiUrl() {
            return window.location.origin;
        },
    },
    watch: {
        // Refresh player status when mediaControls is shown
        value(val) {
            if (val && this.mounted) {
                this.cells.forEach((c) => c.manualRefresh());
            }
        },
    },
    created() {
        // Nothing else needs to be updated in an interval, except for checking for mute changes
        // Premature optimization.... probably
        if (!this.timer) {
            this.timer = setInterval(() => {
                // While MediaControls is shown, the scrim covers the players, so mute cannot be
                // changed directly inside an embed. Yet manualCheckMuted writes the player's
                // actual muted state back to the store one-way, so right after the store is updated
                // (setMuteOthers, mute all, etc.), polling can read the stale actual state and revert
                // it before the asynchronous :mute prop update reaches the player (a nondeterministic race).
                // Stop this read-back while shown; changes made inside the player are still picked up while hidden.
                if (this.value) return;
                if (this.cells) this.cells.forEach((c) => c.manualCheckMuted());
            }, 1000);
        }
    },
    mounted() {
        this.mounted = true;
    },
    beforeUnmount() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    },
    methods: {
        setAllVolume(val) {
            this.cells.forEach((c) => c.setVolume(val));
        },
        allCellAction(fnName) {
            if (!this.$parent.$refs.videoCell) return;
            const cells = this.$parent.$refs.videoCell;
            cells.forEach((c) => {
                switch (fnName) {
                    case "mute": c.setMuted(true); break;
                    // Note: the Twitch embed rejects play() from external JS for lack of user
                    // activation (only the native ▶ inside the iframe can start playback). Autoplay
                    // and reloading the iframe do not get around it, so play has no effect on Twitch cells.
                    // YouTube plays as usual.
                    case "play": c.setPlaying(true); break;
                    case "pause": c.setPlaying(false); break;
                    case "unmute": c.setMuted(false); break;
                    case "refresh": c.refresh(); break;
                    // Streams that are live will be able to sync up, while the rest videos get toggled
                    case "sync": c.video.status === "live"
                        ? c.setPlaybackRate(2)
                        : c.togglePlaybackRate(); break;
                    default: break;
                }
            });
        },
    },
};
</script>

<style>
/* Tighten the gap between the title and the body (the first row of icons).
   v-card-text's default top padding (16px) and v-list's top padding stack up and
   make the top gap look large, so set both to 0. */
.mc-title-bar {
  padding-bottom: 4px;
}
.mc-card-text {
  padding-top: 0;
}
.media-controls-list {
  padding-top: 0;
}
/* Keep v-list-item__content at full width; wrapping breaks if it narrows. */
.media-controls-list .v-list-item__content {
  width: 100%;
}
/* "Mute others" switch: the thumb sticks out slightly to the left of the track, but
   .v-list-item__content and .v-selection-control__wrapper clip that left edge with
   overflow:hidden. Make both visible and add left padding to the row so the circle is not cut off. */
.mc-switch-row {
  padding-left: 16px;
}
.mc-switch-row .v-list-item__content,
.mc-switch-row .v-input,
.mc-switch-row .v-input__control,
.mc-switch-row .v-selection-control,
.mc-switch-row .v-selection-control__wrapper,
.mc-switch-row .v-selection-control__input {
  overflow: visible !important;
}
/* Volume number label (same styling as ChannelRow). */
.mc-volume-label {
  width: 28px;
  text-align: right;
  flex: 0 0 28px;
}
/* Upstream Holodex (Vuetify 2) laid out v-list-item-action with flex-wrap; the 36px buttons and the
   slider (flex-basis:75px) were allowed to wrap and fit naturally (no clipped thumb).
   Vuetify 3 icon buttons default to 48px, so shrink them to 36px and use the same flex-wrap structure. */
.mc-btn-row {
  width: 100%;
  flex-wrap: wrap;
  gap: 8px;
}
.mc-btn-row .v-btn.v-btn--icon.v-btn--size-default {
  height: 36px;
  width: 36px;
}
.mc-btn-row .v-btn.v-btn--icon.v-btn--size-default .v-icon {
  font-size: 24px;
}
/* The all-cells row (6 buttons) and the per-cell rows (4) leave different widths after v-spacer, so
   the slider lengths would differ. Use a fixed width so they match. */
.volume-slider {
  flex: 0 0 180px;
  max-width: 180px;
  box-sizing: border-box;
}
/* Vuetify 3's v-slider has a thicker track/thumb than Vuetify 2 (upstream used the thin default with no density set).
   Slim them to a 2px track and 12px thumb, the same way as ChannelRow. */
.volume-slider .v-slider-track__background,
.volume-slider .v-slider-track__fill {
  height: 2px !important;
}
.volume-slider .v-slider-track {
  --v-slider-track-size: 2px;
}
.volume-slider .v-slider-thumb__surface {
  width: 12px;
  height: 12px;
}
.volume-slider .v-slider-thumb {
  --v-slider-thumb-size: 12px;
}

.media-controls-list > .v-list-item {
  border-bottom: 1px solid gray;
}
/* All-cells control row: keep the round buttons (36px) from overflowing the row height and getting
   clipped at the bottom. Vuetify 3's v-list-item sizes itself from a min-height variable, so raise it
   enough for the content and make overflow visible so nothing sticking out is clipped. */
.mc-all-row {
  --v-list-item-min-height: 52px;
  overflow: visible;
}
.mc-all-row .v-list-item__content {
  overflow: visible;
}

/* Vuetify 3's v-list-item stacks its children vertically in an internal wrapper, so they cannot sit side by side.
   Each row is built from plain divs with the same layout as upstream Holodex (Vuetify 2): icon on the left,
   title + buttons on the right. */
.mc-row {
  align-items: center;
  padding: 8px 16px;
  border-bottom: 1px solid gray;
}
.mc-row > a {
  flex: 0 0 auto;
  align-self: center;
}
/* Flex children default to min-width:auto and will not shrink below their content, so without this a
   long title widens the row and a horizontal scrollbar appears (and title ellipsis stops working).
   Set 0 explicitly. */
.mc-content {
  min-width: 0;
}
.mc-btn-row {
  min-width: 0;
}
/* Line 1 = channel name, line 2 = stream title. Both truncate to a single line with an ellipsis (as in Vuetify 2). */
.mc-channel,
.mc-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mc-channel {
  font-size: 0.9rem;
}
/* The stream title is less prominent than the channel name (smaller and fainter). */
.mc-title {
  font-size: 0.8rem;
  opacity: 0.7;
}

.mc-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  overflow: hidden;
  flex: 0 0 40px;
}
</style>
