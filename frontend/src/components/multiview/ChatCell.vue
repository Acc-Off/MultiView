<template>
  <div class="cell-content">
    <!-- Top channel switch select -->
    <div class="d-flex flex-row align-center py-1">
      <v-btn
        icon
        size="small"
        variant="text"
        class="mx-1"
        :disabled="currentPos <= 0"
        @click="stepTab(-1)"
      >
        <v-icon>{{ icons.mdiChevronLeft }}</v-icon>
      </v-btn>
      <v-select
        v-model="currentTab"
        :items="channels"
        item-title="text"
        variant="outlined"
        density="compact"
        hide-details
        class="tabbed-chat-select mx-1"
      />
      <v-btn
        icon
        size="small"
        variant="text"
        class="mx-1"
        :disabled="currentPos >= channels.length - 1"
        @click="stepTab(1)"
      >
        <v-icon>{{ icons.mdiChevronRight }}</v-icon>
      </v-btn>
    </div>
    <!-- Yt/Twitch Chat window -->
    <template v-if="currentVideo && currentTab >= 0">
      <!-- Archive chat cannot be embedded (see chatUnavailable below), so show a notice instead of the iframe's error page -->
      <div
        v-if="chatUnavailable"
        class="pa-3 text-caption text-medium-emphasis d-flex align-center justify-center text-center"
        style="height: calc(100% - 32px)"
      >
        {{ $t("views.multiview.chatArchiveUnavailable") }}
      </div>
      <iframe
        v-else
        :src="chatLink"
        style="width: 100%; height: calc(100% - 32px)"
        frameborder="0"
      />
    </template>
    <div v-else style="height: 100%" />
    <!-- Bottom controls -->
    <div v-if="!editMode" class="d-flex">
      <v-btn
        size="x-small"
        width="100%"
        class="flex-shrink-1"
        @click="editMode = !editMode"
      >
        <v-icon size="small" class="mr-1">
          {{ icons.mdiPencil }}
        </v-icon>
        <template v-if="cellWidth > 200">
          {{ $t("component.videoCard.edit") }}
        </template>
      </v-btn>
    </div>
    <!-- Edit mode cell controls -->
    <CellControl
      v-else
      :play-icon="icons.mdiCheck"
      @playpause="editMode = false"
      @back="resetCell"
      @delete="deleteCell"
    />
  </div>
</template>

<script lang="ts">
import { mapState } from "@/store/helpers";
import { useSettingsStore } from "@/store/settings.store";
import CellMixin from "./CellMixin";
import CellControl from "./CellControl.vue";

export default {
    name: "ChatCell",
    components: {
        CellControl,
    },
    mixins: [CellMixin],
    props: {
        item: {
            type: Object,
            required: true,
        },
        cellWidth: {
            type: Number,
            default: 0,
        },
    },
    computed: {
        ...mapState("multiview", ["layout", "layoutContent"]),
        currentVideo() {
            if (!this.activeVideos.length || this.currentTab >= this.activeVideos.length) return null;
            return this.activeVideos[this.currentTab] || this.activeVideos[0];
        },
        currentTab: {
            get() {
                return this.layoutContent[this.item.i].currentTab ?? 0;
            },
            set(value) {
                this.mvStore.setLayoutContentWithKey({
                    id: this.item.i,
                    key: "currentTab",
                    value,
                });
            },
        },
        // YouTube chat replay (live_chat_replay) for archives (past streams) has no official external
        // embedding mechanism like embed_domain and cannot be shown in a plain iframe (upstream Holodex
        // works around this by rewriting headers in the Holodex Plus extension). This check lets us show
        // a notice instead of an error page.
        // Twitch is excluded: its chat is per channel and can be embedded regardless of stream state.
        // Videos with unknown status (data not fetched yet) still try the iframe as before.
        chatUnavailable() {
            const v = this.currentVideo;
            if (!v) return false;
            if (v.type === "twitch" || v.channel?.platform === "twitch") return false;
            return !!v.status && v.status !== "live" && v.status !== "upcoming";
        },
        // Embed URL for YouTube / Twitch chat
        chatLink() {
            const parent = window.location.hostname;
            const v = this.currentVideo;
            // Detect Twitch by checking both type and platform, like VideoCell.isTwitchVideo.
            // Twitch videos added by URL or restored from a shared URL only have type==="twitch" and no
            // channel.platform; checking platform alone falls through to YouTube's live_chat and no chat shows.
            // The login name is in channel.id when the video comes from the list (has platform), otherwise in
            // video.id (URL-added videos have no channel.id at all, and for placeholder-derived ones the
            // channel is the YouTube one).
            if (v.type === "twitch" || v.channel?.platform === "twitch") {
                const login = v.channel?.platform === "twitch" ? v.channel.id : v.id;
                return `https://www.twitch.tv/embed/${login}/chat?parent=${parent}${this.darkMode ? "&darkpopout" : ""}`;
            }
            return `https://www.youtube.com/live_chat?v=${v.id}&embed_domain=${parent}${this.darkMode ? "&dark_theme=1" : ""}`;
        },
        darkMode() {
            return useSettingsStore().darkMode;
        },
        // Dropdown options. The value stays currentTab (= the array index into activeVideos); only the display
        // order is sorted column-first (x, then y) by the cells' current coordinates. The array order is fixed
        // by the coordinates at the time a preset was applied, so it drifts from the on-screen layout after
        // reordering or dragging. Re-sorting from the coordinates every time keeps it in step.
        channels() {
            return this.layout
                .filter((item) => this.layoutContent[item.i]?.type === "video")
                .map((item, index) => ({ item, index }))
                .sort((a, b) => a.item.x - b.item.x || a.item.y - b.item.y)
                .map(({ item, index }) => ({
                    text: this.layoutContent[item.i].video.channel.name,
                    value: index,
                }));
        },
        // Current position within the display-order list. Used to enable/disable the ◀▶ buttons (-1 when currentTab is invalid).
        currentPos() {
            return this.channels.findIndex((c) => c.value === this.currentTab);
        },
    },
    watch: {
        cellContent(nw) {
            if (nw.type === "chat") {
                this.editMode = false;
            }
        },
    },
    methods: {
        // The ◀▶ buttons also step through the display order (channels). When currentTab is invalid (position -1), ▶ moves to the first entry.
        stepTab(delta) {
            const next = this.channels[this.currentPos + delta];
            if (next !== undefined) this.currentTab = next.value;
        },
    },
    created() {
        this.editMode = false;
    },
};
</script>

<style>
.tabbed-chat-select {
  min-width: 0;
}
/* Upstream Holodex (Vuetify 2) squeezed the v-select down to min-height 28px (via Vuetify 2's .v-input__slot).
   In Vuetify 3 the structure changed to .v-field/.v-field__input, so the Vuetify 2 selectors no longer
   matched and it stayed at the (large) default. Squeeze it back to about 28px using the Vuetify 3 class
   names (it is auxiliary UI in a chat cell, so keep it as small as possible). */
.tabbed-chat-select .v-field {
    --v-field-padding-top: 0px;
    --v-field-padding-bottom: 0px;
}
.tabbed-chat-select .v-field__input {
    min-height: 28px;
    padding-top: 0;
    padding-bottom: 0;
    font-size: 0.8125rem;
}
.tabbed-chat-select .v-field__append-inner {
    padding-top: 2px;
}
.tabbed-chat-select .v-field__append-inner .v-icon {
    font-size: 20px;
}
.chat-btns {
  display: flex;
}
</style>
