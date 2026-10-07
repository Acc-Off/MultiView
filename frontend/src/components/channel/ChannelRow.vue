<template>
  <!-- Vuetify 3's v-list-item is a CSS grid internally (prepend/content/append), which breaks plain
       child placement and the fixed height that virtual scrolling relies on. Build the fixed 64px row from a plain flex div. -->
  <div class="ch-row d-flex align-center px-2 ch-row-border" :class="{ 'ch-row--hidden': hidden }">
    <div class="ch-avatar mr-3" :class="{ outlined: live }">
      <ChannelImg :channel="imgChannel" :size="48" />
    </div>

    <div class="ch-content" style="min-width: 0">
      <div class="ch-title d-flex align-center" style="gap: 6px">
        <v-icon
          size="small"
          :color="channel.platform === 'youtube' ? '#FF0000' : '#8D44F7'"
          :title="channel.platform === 'youtube' ? 'YouTube' : 'Twitch'"
        >
          {{ channel.platform === "youtube" ? icons.mdiYoutube : icons.mdiTwitch }}
        </v-icon>
        <a
          class="ch-name ch-link"
          :href="channelUrl"
          target="_blank"
          rel="noopener noreferrer"
          :title="channel.name"
        >{{ channel.name }}</a>
      </div>
      <div class="ch-subtitle d-flex align-center flex-wrap" style="gap: 12px">
        <span class="d-inline-flex align-center" :title="$t('views.channels.liveTarget')">
          <v-icon size="x-small" :color="channel.live ? 'green' : 'grey'" class="mr-1">
            {{ channel.live ? icons.mdiCheck : icons.mdiMinus }}
          </v-icon>
          {{ $t("views.channels.liveTarget") }}
        </span>
        <span class="d-inline-flex align-center" :title="$t('views.channels.videoTarget')">
          <v-icon size="x-small" :color="channel.video ? 'green' : 'grey'" class="mr-1">
            {{ channel.video ? icons.mdiCheck : icons.mdiMinus }}
          </v-icon>
          {{ $t("views.channels.videoTarget") }}
        </span>
      </div>
    </div>

    <!-- Channel volume (kept local while dragging; committed on release) -->
    <div class="d-none d-sm-flex align-center mr-2" style="width: 160px; gap: 4px">
      <v-icon size="small" @click="toggleMute">
        {{ muted ? icons.mdiVolumeMute : icons.mdiVolumeHigh }}
      </v-icon>
      <v-slider
        v-model="sliderValue"
        :max="100"
        :min="0"
        :step="1"
        hide-details
        density="compact"
        color="primary"
        class="ch-volume-slider"
        :title="$t('views.channels.volume')"
        @end="commitVolume"
      />
      <span class="text-caption text-medium-emphasis" style="width: 28px; text-align: right">
        {{ sliderValue }}
      </span>
    </div>

    <!-- Favorite -->
    <v-btn icon variant="text" :title="$t('views.channels.favorite')" @click="$emit('toggle-favorite')">
      <v-icon :color="favorited ? 'red' : 'grey'">
        {{ favorited ? icons.mdiHeart : icons.mdiHeartOutline }}
      </v-icon>
    </v-btn>

    <!-- Hidden -->
    <v-btn icon variant="text" :title="hiddenTitle" @click="$emit('toggle-hidden')">
      <v-icon :color="hidden ? 'red' : 'grey'">
        {{ hidden ? icons.mdiEyeOff : icons.mdiEye }}
      </v-icon>
    </v-btn>
  </div>
</template>

<script lang="ts">
import ChannelImg from "@/components/channel/ChannelImg.vue";

export default {
    name: "ChannelRow",
    components: { ChannelImg },
    props: {
        channel: { type: Object, required: true },
        live: { type: Boolean, default: false },
        favorited: { type: Boolean, default: false },
        hidden: { type: Boolean, default: false },
        // Channel volume entry { volume, muted } or null (unset = the player default of 100)
        volumeEntry: { type: Object, default: null },
    },
    data() {
        return {
            // Held locally while dragging and committed to the parent only on release (keeps re-renders down)
            sliderValue: this.volumeEntry ? this.volumeEntry.volume : 100,
        };
    },
    computed: {
        imgChannel() {
            return { id: this.channel.id, name: this.channel.name };
        },
        muted() {
            return this.volumeEntry ? !!this.volumeEntry.muted : false;
        },
        hiddenTitle() {
            return `${this.$t("views.channels.hidden")} — ${this.$t("views.channels.hiddenHint")}`;
        },
        // Where clicking the name goes. There is no in-app channel page, so open the external site (YouTube/Twitch).
        channelUrl() {
            return this.channel.platform === "youtube"
                ? `https://www.youtube.com/channel/${this.channel.id}`
                : `https://www.twitch.tv/${this.channel.id}`;
        },
    },
    watch: {
        // Reflect changes made elsewhere (in the multiview, by an import, or in another window) in the slider
        volumeEntry(nv) {
            this.sliderValue = nv ? nv.volume : 100;
        },
    },
    methods: {
        commitVolume(val) {
            this.$emit("set-volume", { volume: val, muted: this.muted });
        },
        toggleMute() {
            this.$emit("set-volume", { volume: this.sliderValue, muted: !this.muted });
        },
    },
};
</script>

<style scoped>
/* Fit exactly within the virtual scroller's fixed item-height (64px) */
.ch-row {
    height: 100%;
    min-height: 0;
    width: 100%;
}
.ch-content {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;
}
.ch-title {
    font-size: 0.95rem;
    line-height: 1.3;
}
.ch-subtitle {
    font-size: 0.8rem;
    line-height: 1.2;
    color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.ch-row--hidden {
    opacity: 0.55;
}
.ch-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.ch-link {
    color: inherit;
    text-decoration: none;
}
.ch-link:hover {
    text-decoration: underline;
}
.ch-avatar {
    flex: 0 0 auto;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
}
.outlined {
    box-shadow: 0 0 0 2px red, 0 0 4px 3px rgba(255, 0, 0, 0.56);
}

/* Vuetify 3's v-slider has a thicker track/thumb than Vuetify 2. Match the old, thinner look:
   a track of about 2px and a smaller thumb. */
.ch-volume-slider :deep(.v-slider-track__background),
.ch-volume-slider :deep(.v-slider-track__fill) {
    height: 2px !important;
}
.ch-volume-slider :deep(.v-slider-track) {
    --v-slider-track-size: 2px;
}
.ch-volume-slider :deep(.v-slider-thumb__surface) {
    width: 12px;
    height: 12px;
}
.ch-volume-slider :deep(.v-slider-thumb) {
    --v-slider-thumb-size: 12px;
}
</style>
