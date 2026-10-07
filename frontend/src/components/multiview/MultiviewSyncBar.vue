<template>
  <v-sheet class="sync-bar d-flex justify-center align-center pa-2">
    <div class="mr-2 d-flex align-center flex-column" style="height: 100%; width: 120px">
      <!-- Left side play button time cluster -->
      <div v-if="minTs" class="text-center text-body-2">
        {{ currentDuration }}
        /
        {{ totalDuration }}
      </div>
      <!-- Upstream Holodex's (Vuetify 2) `<v-btn icon>` had a transparent background and a medium-emphasis
           (0.54) icon, but Vuetify 3's `<v-btn icon>` defaults to variant="elevated": a surface background
           with full emphasis (0.87), which makes the icons look darker and the background stand out in
           light mode. Add variant="text" to every icon button to match upstream's transparent flat look. -->
      <div class="d-flex justify-space-between align-center">
        <v-btn icon variant="text" @click="setTime(currentTs - 10)">
          <v-icon>
            {{ mdiRewind10 }}
          </v-icon>
        </v-btn>
        <v-btn icon variant="text" @click="paused = !paused">
          <v-icon size="large">
            {{ paused ?icons.mdiPlay : mdiPause }}
          </v-icon>
        </v-btn>
        <v-btn icon variant="text" @click="setTime(currentTs + 10)">
          <v-icon>
            {{ mdiFastForward10 }}
          </v-icon>
        </v-btn>
      </div>
      <div>
        <v-btn icon variant="text" @click="showConfiguration = !showConfiguration">
          <v-icon size="small">
            {{ icons.mdiCog }}
          </v-icon>
        </v-btn>
        <v-menu location="top">
          <template #activator="{ props }">
            <v-btn
              icon
              variant="text"
              v-bind="props"
            >
              <v-icon size="small">
                {{ mdiPlaySpeed }}
              </v-icon>
            </v-btn>
          </template>
          <v-list density="compact">
            <v-list-item
              v-for="availablePlaybackRate in availablePlaybackRates"
              :key="`playbackRateSelector-${availablePlaybackRate}`"
              @click="playbackRate = availablePlaybackRate"
            >
              <template #prepend>
                <v-icon v-if="playbackRate === availablePlaybackRate" class="mr-2">
                  {{ icons.mdiCheck }}
                </v-icon>
                <span v-else class="mr-2" style="width: 24px" />
              </template>
              <v-list-item-title>
                {{ availablePlaybackRate }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
        <v-btn icon variant="text" @click="onShareClick">
          <v-icon size="small">
            {{ mdiLinkVariant }}
          </v-icon>
        </v-btn>
      </div>
    </div>
    <!-- Main slider and progress -->
    <div class="flex-grow-1 align-self-start" style="position: relative">
      <!-- Hovering time, must be outside of overflowed container  -->
      <div class="time-tooltip-wrapper">
        <div
          v-show="hovering"
          class="time-tooltip"
          :style="{ marginLeft: timeTooltipLeft }"
        >
          {{ timeTooltipText }}
        </div>
      </div>
      <!-- Container with overflow scroll -->
      <div class="progressSlider pr-2">
        <div v-if="!hasVideosToSync">
          {{ $t("views.multiview.sync.nothingToSync") }}
        </div>
        <div v-show="hasVideosToSync" style="position: relative">
          <!-- Slider -->
          <div ref="sliderContainer" class="slider-container">
            <input
              ref="slider"
              type="range"
              min="0"
              max="100"
              :value="currentProgress"
              class="sync-slider"
              step="0.01"
              @input="onSliderInput"
            >
          </div>
          <!-- List of progress bars with icons -->
          <template v-for="(v) in splitProgressBarData" :key="v.id">
            <div class="d-flex align-center my-1">
              <channel-img
                :channel="v.channel"
                :size="24"
                class="px-1"
                rounded
                no-alt
              />
              <!-- IMPORTANT flex, this makes left: x% correspond to the correct dimensions-->
              <!-- If you see the slider desync with progress bars, make sure x% is accurate to the slider-container -->
              <div class="flex">
                <v-progress-linear
                  style="z-index: 1;"
                  color="secondary"
                  :style="{
                    marginLeft: (v.offset*100).toFixed(2) + '%',
                    width: (v.width*100).toFixed(2) + '%',
                    height: '8px',
                  }"
                  :model-value="currentProgressByVideo[v.id] || 0"
                />
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
    <v-dialog v-model="showConfiguration" max-width="450px">
      <v-card>
        <v-card-title>{{ $t("views.multiview.sync.syncSettings") }}</v-card-title>
        <v-card-text>
          {{ $t("views.multiview.sync.syncSettingsDetail") }}
          <template v-for="v in overlapVideos" :key="v.id">
            <div class="d-flex justify-space-between my-1">
              <channel-img
                :channel="v.channel"
                :size="40"
                rounded
                no-alt
              />
              <div class="d-flex align-center">
                <v-btn elevation="1" @click="setOffset(v.id, (offsets[v.id] || 0) - 0.5)">
                  -0.5
                </v-btn>
                <v-text-field
                  label="Offset"
                  variant="outlined"
                  density="compact"
                  hide-details
                  :model-value="offsets[v.id] || '0'"
                  type="number"
                  suffix="sec"
                  @update:model-value="setOffset(v.id, +$event)"
                />
                <v-btn elevation="1" @click="setOffset(v.id, (offsets[v.id] || 0) + 0.5)">
                  +0.5
                </v-btn>
              </div>
            </div>
          </template>
        </v-card-text>
      </v-card>
    </v-dialog>
    <v-snackbar v-model="doneCopy" color="success">
      {{ $t("component.videoCard.copiedToClipboard") }}
    </v-snackbar>
  </v-sheet>
</template>

<script lang="ts">
import { mapState, mapGetters } from "@/store/helpers";
import { useMultiviewStore } from "@/store/multiview.store";
import { formatDuration, dayjs } from "@/utils/time";
import throttle from "lodash-es/throttle";
import copyToClipboard from "@/mixins/copyToClipboard";
import {
    mdiPause, mdiFastForward10, mdiRewind10, mdiLinkVariant, mdiPlaySpeed,
} from "@mdi/js";
import { encodeLayout } from "@/utils/mv-utils";
import ChannelImg from "../channel/ChannelImg.vue";

export default {
    name: "MultiviewSyncBar",
    components: { ChannelImg },
    mixins: [copyToClipboard],
    data() {
        return {
            mdiPause,
            mdiFastForward10,
            mdiRewind10,
            mdiLinkVariant,
            mdiPlaySpeed,

            availablePlaybackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2],
            lastSyncTimeMillis: Date.now(),
            paused: true,
            hovering: false,
            hoverTs: 0,
            currentTs: 0,
            currentProgressByVideo: {},
            playbackRate: 1,
            timeTooltipLeft: 0,
            timeTooltipText: "",
            timer: null,
            firstPlay: true,
            showConfiguration: false,
        };
    },
    computed: {
        ...mapState("multiview", ["layout", "layoutContent", "presetLayout", "autoLayout"]),
        ...mapGetters("multiview", ["activeVideos"]),
        pastVideos() {
            return this.activeVideos.filter((v) => v.status === "past");
        },
        videoWithTs() {
            const videos = this.pastVideos.map((v) => ({
                ...v,
                startTs: dayjs(v.available_at).unix(),
                endTs: dayjs(v.available_at).unix() + v.duration,
            }));
            videos.sort((a, b) => a.startTs - b.startTs);
            return videos;
        },
        overlapVideos() {
            // Overlapping video list
            const ol = [];
            this.videoWithTs.forEach((v) => {
                // Push first video in, if none exists
                if (!ol.length) {
                    ol.push(v);
                    return;
                }
                // Video is within an hour threshold:
                // stream1 start <- [max 1 hour] -> stream2 end...
                if (v.startTs - ol[ol.length - 1].endTs < 60 * 60) {
                    ol.push(v);
                // Reset list if not within any bounds/threshold
                } else if (ol.length === 1) {
                    ol.splice(0, 1, v);
                }
            });
            return ol;
        },
        minTs() {
            if (!this.hasVideosToSync) return 0;
            return Math.min(...this.overlapVideos.map((v) => v.startTs));
        },
        maxTs() {
            if (!this.hasVideosToSync) return 0;
            return Math.max(...this.overlapVideos.map((v) => v.endTs));
        },
        splitProgressBarData() {
            const totalTime = this.maxTs - this.minTs;
            return this.overlapVideos.map((v) => ({
                id: v.id,
                channel: v.channel,
                offset: (v.startTs - this.minTs) / totalTime,
                width: (v.endTs - v.startTs) / totalTime,
            }));
        },
        currentProgress() {
            return this.getPercentForTime(this.currentTs);
        },
        currentDuration() {
            return formatDuration(Math.round(this.currentTs - this.minTs) * 1000);
        },
        totalDuration() {
            return formatDuration((this.maxTs - this.minTs) * 1000);
        },
        hasVideosToSync() {
            return this.overlapVideos.length >= 1;
        },
        routeCurrentTs() {
            return this.$route.query.t;
        },
        routeOffsets() {
            return this.$route.query.offsets?.split(",");
        },
        offsets() {
            const local = useMultiviewStore().syncOffsets;
            if (this.routeOffsets && this.overlapVideos.length) {
                return this.overlapVideos.map((v, index) => ({
                    [v.id]: local[v.id] ?? +this.routeOffsets[index],
                })).reduce((a, c) => ({ ...a, ...c }), {});
            }
            return local;
        },
    },
    watch: {
        paused(pause) {
            this.$parent.$refs.videoCell
                .forEach((cell) => {
                    const { video } = cell;
                    const olVideo = video && this.overlapVideos.find((v) => v.id === video.id);
                    if (olVideo && pause) cell.setPlaying(false);
                    else this.setTime(this.currentTs);
                });
        },
        playbackRate(playbackRate) {
            this.$parent.$refs.videoCell
                .forEach((cell) => {
                    const { video } = cell;
                    const olVideo = video && this.overlapVideos.find((v) => v.id === video.id);
                    if (olVideo) {
                        cell.setPlaybackRate(playbackRate);
                    }
                });
        },
    },
    mounted() {
        this.startTimer();
        this.$refs.sliderContainer.addEventListener("mouseenter", this.onMouseEnter, false);
        this.$refs.sliderContainer.addEventListener("mousemove", this.onMouseOver, false);
        this.$refs.sliderContainer.addEventListener("mouseout", this.onMouseLeave, false);
        // Stops Firefox scroll behavior on slider
        // eslint-disable-next-line func-names
        this.$refs.slider.addEventListener("mousewheel", function () { this.blur(); }, false);
    },
    beforeUnmount() {
        this.timer && clearInterval(this.timer);
        this.$refs.sliderContainer.removeEventListener("mouseenter", this.onMouseEnter);
        this.$refs.sliderContainer.removeEventListener("mousemove", this.onMouseOver);
        this.$refs.sliderContainer.removeEventListener("mouseout", this.onMouseLeave);
    },
    methods: {
        onMouseEnter() {
            this.hovering = true;
        },
        // eslint-disable-next-line func-names
        onMouseOver: throttle(function (e) {
            const offsetLeft = e.target.getBoundingClientRect().x;
            // Get x percentage that the mouse is hoveirng on
            const percent = ((e.clientX - offsetLeft) / e.target.clientWidth) * 100;
            if (!(percent >= 0 && percent <= 100)) return;
            // Show a tooltip of this percent
            this.hoverTs = this.getTimeForPercent(percent);
            this.timeTooltipLeft = `${percent}%`;
            this.timeTooltipText = `${this.formatUnixTime(this.hoverTs)}\n${formatDuration((this.hoverTs - this.minTs) * 1000)}/${this.totalDuration}`;
        }, 10),
        onMouseLeave() {
            this.hovering = false;
        },
        // eslint-disable-next-line func-names
        onSliderInput: throttle(function (e) {
            // onChange event is less reliable than input event, causing weird bounce back effect
            const ts = this.getTimeForPercent((e.target.value));
            this.setTime(ts);
        }, 50),
        getTimeForPercent(percent) {
            return ((percent / 100) * (this.maxTs - this.minTs)) + this.minTs;
        },
        getPercentForTime(ts) {
            return ((ts - this.minTs) / (this.maxTs - this.minTs)) * 100;
        },
        getProgressPercentByAbsoluteTime(ts, video) {
            return Math.min(100, Math.max(((ts - video.startTs) / (video.endTs - video.startTs)) * 100, 0));
        },
        sync() {
            if (!this.$parent?.$refs?.videoCell || !this.hasVideosToSync) return;

            // Calculate the time delta between this `sync` call and the previous.
            const currentSyncTimeMillis = Date.now();
            const syncDeltaTime = (currentSyncTimeMillis - this.lastSyncTimeMillis) / 1000;
            this.lastSyncTimeMillis = currentSyncTimeMillis;

            // Find start time if first initialization
            if (this.currentTs <= 0 || this.currentTs < this.minTs || this.currentTs > this.maxTs) {
                this.currentTs = this.findStartTime();
            } else if (!this.paused) {
                // Update currentTs by delta if we are not paused
                this.currentTs = Math.min(Math.max(this.currentTs + syncDeltaTime * this.playbackRate, this.minTs), this.maxTs);
            }

            // Max second desync, before it forces resync
            const DELTA_THRESHOLD = 1.5 * this.playbackRate;
            // DEBUG TOOL: current video deltas (diff between currentTs/true time)
            // const deltas = [];
            this.$parent.$refs.videoCell
                .forEach((cell) => {
                    const { video, currentTime } = cell;
                    // Find corresponding overlapping video
                    const olVideo = video && this.overlapVideos.find((v) => v.id === video.id);
                    if (!olVideo) return;

                    // Update pervideo progress bar
                    const percentProgress = this.currentTs > olVideo.endTs ? 100 : ((currentTime / olVideo.duration) * 100).toFixed(2);
                    this.currentProgressByVideo[olVideo.id] = percentProgress;

                    // Calc delta times to keep things in sync
                    const expectedDuration = this.currentTs - olVideo.startTs + (this.offsets[olVideo.id] ?? 0);
                    const delta = Math.abs(expectedDuration - currentTime);
                    const isBefore = expectedDuration < 0;
                    const isAfter = expectedDuration / olVideo.duration > 1;
                    // deltas.push(delta);
                    if (isBefore || isAfter) {
                        cell.setPlaying(false);
                        // Sync if current cell delta is over 2 seconds
                    } else if (expectedDuration > 0 && delta > DELTA_THRESHOLD) {
                        cell.setPlaying(!this.paused);
                        cell.seekTo(expectedDuration);
                        cell.setPlaybackRate(this.playbackRate);
                    }
                });
            // console.log("deltas: ", deltas);
        },
        // Find a start time from current player times or use minTs
        findStartTime() {
            if (this.routeCurrentTs) return +this.routeCurrentTs;
            const times = [];
            let firstOverlap = this.minTs;
            if (!this.$parent?.$refs?.videoCell) return this.minTs;
            this.$parent.$refs.videoCell
                .forEach((cell, index) => {
                    const { video, currentTime } = cell;
                    // Find corresponding overlapping video
                    const olVideo = video && this.overlapVideos.find((v) => v.id === video.id);
                    if (!olVideo) return;
                    const t = currentTime + olVideo.startTs;
                    // Find times that is within 2 seconds of other videos
                    if (index === 0 || Math.abs(times[index - 1] - t) < 2000) {
                        times.push(t);
                    }
                    if (olVideo.startTs > firstOverlap && olVideo.endTs > firstOverlap) {
                        firstOverlap = olVideo.startTs;
                    }
                });
            // Return average if all the times are close
            if (times.length === this.overlapVideos.length) {
                return times.reduce((a, c) => a + c, 0) / times.length;
            }
            // Use first overlapping time as start time
            return firstOverlap;
        },
        // Set to a certain timestamp
        setTime(ts) {
            this.currentTs = ts;
            this.$parent.$refs.videoCell
                .forEach((cell) => {
                    const { video } = cell;
                    const olVideo = video && this.overlapVideos.find((v) => v.id === video.id);
                    if (!olVideo) return;

                    const nextTime = ts - olVideo.startTs;
                    const isBefore = nextTime < 0;
                    const isAfter = nextTime / olVideo.duration > 1;
                    if (isBefore || isAfter) {
                        cell.setPlaying(false);
                        cell.seekTo(isBefore ? 0 : olVideo.duration - 1);
                        return;
                    }

                    if (this.firstPlay) {
                        this.paused = false;
                        this.firstPlay = false;
                    }
                    cell.setPlaying(!this.paused);
                    cell.seekTo(nextTime);
                });
        },
        startTimer() {
            if (this.timer) clearInterval(this.timer);
            this.timer = setInterval(this.sync, 500);
        },
        formatUnixTime(ts) {
            return dayjs.unix(ts).format("LTS");
        },
        setOffset(id, value) {
            useMultiviewStore().setSyncOffsets({ id, value });
        },
        onShareClick() {
            const layoutParam = encodeURIComponent(
                encodeLayout({
                    layout: this.layout,
                    contents: this.layoutContent,
                    includeVideo: true,
                }),
            );
            const params = new URLSearchParams();
            if (this.currentTs) params.append("t", String(Math.round(this.currentTs)));
            const offsetArr = this.overlapVideos.map((v) => this.offsets[v.id] ?? 0);
            if (offsetArr.find((o) => +o)) params.append("offsets", offsetArr.join(","));
            this.copyToClipboard(`${window.origin}/multiview/${layoutParam}${params.toString() ? `?${params.toString()}` : ""}`);
        },
        formatDuration,
    },
};
</script>

<style lang="scss">
// Offsets the slider by 32px for channel icons
$slider-left-offset: 32px;
// Offests the slider by width of scrollbar
$slider-right-offset: 8px;
// Slider height
$slider-height: 90px;

.sync-bar {
    width: 100%;
    height: 100px;
    position: sticky;
    bottom: 0;
    box-shadow: 0px 11px 15px -7px rgb(0 0 0 / 20%), 0px 24px 38px 3px rgb(0 0 0 / 14%), 0px 9px 46px 8px rgb(0 0 0 / 12%) !important;
}
/* The playback controls on the left put 3 icon buttons in a fixed width:120px.
   Vuetify 3's `<v-btn icon>` defaults to 48px, so 3 of them take 144px, overflow and wrap
   (upstream Holodex on Vuetify 2 was 36px each and fit in 108px). Squeeze them to 36px using the
   Vuetify 3 class names to get back upstream's single row (icon sizes stay as set by their size props). */
.sync-bar .v-btn.v-btn--icon.v-btn--size-default {
    width: 36px;
    height: 36px;
}
/* Fix the color difference in the sync bar (light theme): Vuetify 3 icon buttons draw their icon at
   full emphasis (0.87) even with variant="text", so on the light (white) background they look darker
   than upstream. Upstream Holodex on Vuetify 2 used flat icons at medium emphasis (0.54), so drop the
   icons to 0.54 in the light theme only (dark is white in both, so it is left alone). Icons with an
   explicit color (secondary etc.) are excluded. */
.v-theme--light .sync-bar .v-btn.v-btn--icon .v-icon {
    color: rgba(0, 0, 0, 0.54);
}
.progressSlider {
    overflow-y: scroll; overflow-x: hidden; height: $slider-height
}
.slider-container {
    position: sticky;
    margin-top: -$slider-height;
    left: $slider-left-offset;
    top: 0;
    width: calc(100% - #{$slider-left-offset});
    height: $slider-height;
    z-index: 5;
    border: none;
}
.sync-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 100%;
  background: none;
  outline: none;
  opacity: 0.7;
  -webkit-transition: .2s;
  transition: opacity .2s;
}

.sync-slider::-webkit-slider-thumb {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  width: 3px; /* Set a specific slider handle width */
  height: $slider-height; /* Slider handle height */
  background: rgb(var(--v-theme-primary)); /* Green background */
  cursor: pointer; /* Cursor on hover */
  opacity: 0.8;
  display: flex;
}
.sync-slider::-moz-range-thumb {
  -webkit-appearance: none; /* Override default look */
  appearance: none;
  width: 3px; /* Set a specific slider handle width */
  height: $slider-height; /* Slider handle height */
  background: rgb(var(--v-theme-primary)); /* Green background */
  cursor: pointer; /* Cursor on hover */
  opacity: 0.8;
  display: flex;
}

.sync-slider:focus {
    outline: none;
}

.time-tooltip-wrapper {
    position: absolute;
    margin-left: $slider-left-offset;
    width: calc(100% - #{$slider-right-offset} - #{$slider-left-offset});
    z-index: 5;
    top: -30px;
}
.time-tooltip {
    display: inline-block;
    white-space: pre;
    text-align: center;
    opacity: 0.7;
    background: black;
    color: white;
    padding: 4px;
    border-radius: 0.25em;
    transform: translate(-50%, -50%);
}
</style>
