<template>
  <!-- One channel in the top bar (avatar + live badge + a VideoCard tooltip shown on hover).
       Two performance measures against the main cause of the top bar lagging a beat / popping in
       when a dialog opens:
       (1) Extract it into its own component. With v-tooltip inlined in VideoSelector, its slot gets
           dragged into the parent's (MultiView) re-render and re-runs for nothing, producing a long
           task of tens of ms just from opening a dialog (this did not happen in Vuetify 2). With a
           component boundary in between, Vue 3 skips the re-render when props are unchanged, which
           stops the propagation.
       (2) Do not create the v-tooltip (= VOverlay) until hover. VOverlay subscribes to the global
           overlay stack, so if always mounted, merely opening a dialog (another overlay) re-renders
           every tooltip at once. The activator is a plain div and the tooltip is first created on
           mouseenter. -->
  <div
    style="position: relative; margin-right: 3px; cursor: pointer"
    draggable="true"
    @dragstart="onDragStart"
    @mouseenter="onEnter"
    @mouseleave="open = false"
  >
    <div :key="'lvbg' + tick" class="live-badge" :class="video.status === 'live' ? 'is-live' : 'is-offline'">
      {{ formatDurationLive }}
    </div>
    <v-avatar size="50" @click="$emit('videoClicked', video)">
      <ChannelImg :channel="video.channel" :size="50" />
    </v-avatar>
    <!-- If left to open-on-hover, the tooltip is not created in time for the hover and the first one never
         shows, so control it explicitly with v-model: create (hovered) and open (open) on mouseenter,
         close on mouseleave. -->
    <v-tooltip
      v-if="hovered"
      v-model="open"
      activator="parent"
      :open-on-hover="false"
      transition="v-fade-transition"
      location="bottom"
    >
      <VideoCard
        :video="video"
        disable-default-click
        include-channel
        style="width: 250px"
      />
    </v-tooltip>
  </div>
</template>

<script lang="ts">
import VideoCard from "@/components/video/VideoCard.vue";
import ChannelImg from "@/components/channel/ChannelImg.vue";
import { dayjs, formatDurationShort } from "@/utils/time";

export default {
    name: "ChannelBarItem",
    components: {
        VideoCard,
        ChannelImg,
    },
    props: {
        video: {
            type: Object,
            required: true,
        },
        // Elapsed-time update trigger passed from the parent (changes every 60 seconds). Taken as a prop so
        // the live badge updates only when it changes; opening or closing a dialog does not change it, so
        // no re-render happens.
        tick: {
            type: Number,
            default: 0,
        },
    },
    emits: ["videoClicked"],
    data() {
        return {
            // false until hover. The v-tooltip is created only once this becomes true (defers the overlay stack subscription).
            hovered: false,
            // Tooltip open state. Controlled explicitly via v-model so it can open in the same frame it is created.
            open: false,
        };
    },
    computed: {
        // Tied to tick so it is recomputed every 60 seconds (it does update, because the template references tick).
        formatDurationLive() {
            const scheduled = dayjs(this.video.start_actual || this.video.start_scheduled);
            const secs = dayjs(scheduled).diff(dayjs()) / 1000;
            return formatDurationShort(Math.abs(secs));
        },
    },
    methods: {
        onEnter() {
            // The first time, create the tooltip and open it once created (nextTick). After that, open immediately.
            if (!this.hovered) {
                this.hovered = true;
                this.$nextTick(() => { this.open = true; });
            } else {
                this.open = true;
            }
        },
        onDragStart(ev) {
            const { video } = this;
            const url = video.channel?.platform === "twitch"
                ? `https://www.twitch.tv/${video.channel.id}`
                : `https://www.youtube.com/watch?v=${video.id}`;
            ev.dataTransfer.setData("text", url);
            ev.dataTransfer.setData("application/json", JSON.stringify(video));
        },
    },
};
</script>
