<template>
  <a
    class="video-card no-decoration d-flex"
    :class="{
      'video-card-fluid': fluid,
      'video-card-active': active,
      'video-card-horizontal': horizontal,
      'video-card-list': denseList,
      'video-card-multiview-active': inMultiViewActiveVideos,
      'flex-column': !horizontal && !denseList,
    }"
    target="_blank"
    :href="href"
    rel="noopener"
    draggable="true"
    style="position: relative"
    @click.exact="onThumbnailClicked"
    @dragstart="drag"
  >
    <!-- Video Image with Duration -->
    <div
      v-if="!denseList"
      style="position: relative; width: 100%"
      class="video-thumbnail text-white rounded flex-shrink-0 d-flex"
      :style="
        horizontal &&
          !shouldHideThumbnail &&
          `background: url(${imageSrc}) center/cover;`
      "
    >
      <PlaceholderOverlay
        v-if="shouldShowPlaceholderOverlay"
        :width="200"
        :height="150"
        :show-only-on-hover="false"
      />
      <!-- Image Overlay -->
      <div
        class="video-card-overlay d-flex justify-space-between flex-column"
        style="height: 100%; position: absolute; width: 100%; z-index: 1"
      >
        <div class="d-flex justify-space-between align-start">
          <!-- Topic Id display -->
          <div
            class="video-topic rounded-tl-sm"
            :style="{ visibility: data.topic_id ? 'visible' : 'hidden' }"
          >
            {{ data.topic_id }}
          </div>

          <!-- Favorite toggle (per channel) -->
          <v-icon
            v-if="data.channel"
            :color="isFavorited ? 'pink' : 'white'"
            class="video-card-action rounded-tr-sm"
            :class="{ 'hover-show': !isFavorited && !isMobile }"
            @click.prevent.stop="toggleFavorite"
          >
            {{ isFavorited ? icons.mdiHeart : icons.mdiHeartOutline }}
          </v-icon>
        </div>

        <!-- Video duration/music indicator (👻❌) -->
        <div v-if="!isPlaceholder" class="d-flex flex-column align-end">
          <!-- Show music icon if songs exist, and song count if there's multiple -->
          <div
            v-if="data.songcount"
            class="video-duration d-flex align-center"
            :title="songIconTitle"
          >
            {{ songCount }}
            <v-icon size="small" color="white">{{ icons.mdiMusic }}</v-icon>
          </div>
          <!-- Show TL chat icon if recently active or has archive tl exist -->
          <div
            v-if="hasTLs"
            class="video-duration d-flex align-center"
            :title="tlIconTitle"
          >
            {{ tlLangInChat }}
            <v-icon size="small" color="white">{{ icons.tlChat }}</v-icon>
          </div>
          <!-- Duration/Current live stream time -->
          <div
            v-if="data.duration > 0 || data.start_actual"
            class="video-duration rounded-br-sm"
            :class="data.status === 'live' && 'video-duration-live'"
          >
            {{ formattedDuration }}
          </div>
        </div>
        <div v-else-if="isPlaceholder" class="d-flex flex-column align-end">
          <!-- (👻✅) -->
          <div class="video-duration">
            <span v-if="hasDuration" class="duration-placeholder">{{
              formattedDuration
            }}</span>
            <span
              v-if="data.placeholderType === 'scheduled-yt-stream'"
              class="hover-placeholder"
            >{{ $t("component.videoCard.typeScheduledYT") }}</span>
            <span
              v-else-if="data.placeholderType === 'external-stream'"
              class="hover-placeholder"
            >{{ $t("component.videoCard.typeExternalStream") }}</span>
            <span
              v-else-if="data.placeholderType === 'event'"
              class="hover-placeholder"
            >{{ $t("component.videoCard.typeEventPlaceholder") }}</span>
            <v-icon color="white" class="rounded-sm">
              {{
                twitchPlaceholder
                  ? mdiTwitch
                  : twitterPlaceholder
                    ? mdiTwitter
                    : placeholderIconMap[data.placeholderType]
              }}
            </v-icon>
          </div>
        </div>
      </div>
      <v-img
        v-if="!horizontal && !shouldHideThumbnail"
        :src="imageSrc"
        :aspect-ratio="16 / 9"
        width="100%"
        cover
        :transition="false"
        class="rounded"
        :class="{
          'hover-opacity': data.placeholderType === 'scheduled-yt-stream',
        }"
      />
      <v-img
        v-else-if="!horizontal && shouldHideThumbnail"
        width="100%"
        :aspect-ratio="60 / 9"
      />
    </div>
    <a
      class="d-flex flex-row flex-grow-1 no-decoration video-card-text"
      :href="watchLink"
      target="_blank"
      rel="noopener"
      @click.exact.stop="goToVideo"
    >
      <!-- Channel icon -->
      <div
        v-if="
          denseList ||
            (includeChannel && includeAvatar && !horizontal && data.channel)
        "
        class="d-flex align-self-center mx-2 flex-column d-flex"
      >
        <ChannelImg :channel="data.channel" rounded class="align-self-center" />
      </div>
      <!-- Three lines for title, channel, available time -->
      <div class="d-flex video-card-lines flex-column">
        <!-- Video title -->
        <div
          :class="[
            'video-card-title ',
            { 'video-watched': hasWatched },
            { 'mt-2': !horizontal && !denseList },
          ]"
          :title="title"
          style="user-select: text"
          :style="{
            'font-size': `${1 - currentGridSize / 16}rem`,
          }"
        >
          <v-tooltip v-if="!isCertain" location="bottom">
            <template #activator="{ props }">
              <v-btn
                icon
                :ripple="false"
                width="17"
                class="plain-button"
                size="x-small"
                v-bind="props"
              >
                <v-icon size="18" color="amber">
                  {{ icons.mdiClockAlertOutline }}
                </v-icon>
              </v-btn>
            </template>
            <span>
              {{ $t("component.videoCard.uncertainPlaceholder") }}
            </span>
          </v-tooltip>
          {{ title }}
        </div>
        <!-- Channel -->
        <div v-if="includeChannel" class="channel-name video-card-subtitle">
          <a
            class="no-decoration"
            :class="{
              'name-vtuber': data.type === 'stream',
            }"
            :href="channelUrl"
            target="_blank"
            rel="noopener"
            :title="data.channel.name"
            @click.stop
          >
            {{ channelName }}
          </a>
        </div>
        <!-- Time/Viewer Info -->
        <div class="video-card-subtitle">
          <span :class="'text-' + data.status" :title="absoluteTimeString">
            {{ formattedTime }}
          </span>
          <!-- (👻❌) -->
          <template
            v-if="data.clips && data.clips.length > 0 && !isPlaceholder"
          >
            •
            <span class="text-primary">
              {{
                $t("component.videoCard.clips", {
                  n: typeof data.clips === "object" ? data.clips.length : +data.clips,
                })
              }}
            </span>
          </template>
          <span
            v-else-if="data.status === 'live' && data.live_viewers > 0"
            class="live-viewers"
          >
            •
            {{
              $t("component.videoCard.watching", [formatCount(data.live_viewers, lang)])
            }}
          </span>
        </div>
      </div>
    </a>
    <!-- optional breaker object to row-break into a new row. -->
    <div
      v-if="!!$slots.action"
      class="video-card-item-actions d-flex align-center"
    >
      <slot name="action" />
    </div>
  </a>
</template>

<script lang="ts">
import {
    formatCount,
    getVideoThumbnails,
    decodeHTMLEntities,
} from "@/utils/functions";
import {
    formatDuration,
    formatDistance,
    dayjs,
    localizedDayjs,
    titleTimeString,
} from "@/utils/time";
import { mdiBroadcast, mdiTwitch, mdiTwitter } from "@mdi/js";
import { mapState } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useMultiviewStore } from "@/store/multiview.store";
import ChannelImg from "@/components/channel/ChannelImg.vue";
import PlaceholderOverlay from "./PlaceholderOverlay.vue";
/* eslint-disable no-unused-vars */

export default {
    name: "VideoCard",
    components: {
        ChannelImg,
        PlaceholderOverlay,
    },
    props: {
        video: {
            // required: true,
            type: Object,
            default: null,
        },
        source: {
            type: Object,
            default: null,
        },
        fluid: {
            required: false,
            type: Boolean,
            default: false,
        },
        includeChannel: {
            required: false,
            type: Boolean,
            default: false,
        },
        includeAvatar: {
            required: false,
            type: Boolean,
            default: false,
        },
        hideThumbnail: {
            required: false,
            type: Boolean,
            default: false,
        },
        horizontal: {
            required: false,
            type: Boolean,
            default: false,
        },
        colSize: {
            required: false,
            type: Number,
            default: 1,
        },
        active: { // TODO: seems always false (see VideoCardList.activeId); 'video-card-active' class is instead toggled via VirtualVideoCardList.activeIndex/checkActive
            required: false,
            type: Boolean,
            default: false,
        },
        disableDefaultClick: {
            required: false,
            type: Boolean,
            default: false,
        },
        activePlaylistItem: {
            type: Boolean,
            default: false,
        },
        parentPlaylistId: {
            type: [Number, String],
            default: null,
        },
        denseList: {
            type: Boolean,
            required: false,
        },
        inMultiViewSelector: {
            type: Boolean,
            required: false,
        },
    },
    data() {
        return {
            forceJPG: true,
            now: Date.now(),
            updatecycle: null,
            mdiTwitch,
            mdiTwitter,
            placeholderIconMap: {
                event: (this as any).icons.mdiCalendar,
                "scheduled-yt-stream": (this as any).icons.mdiYoutube,
                "external-stream": mdiBroadcast,
            },
        };
    },
    computed: {
        ...mapState("root", ["currentGridSize"]),
        data() {
            return this.source || this.video;
        },
        // MultiView does not track watched videos, so this is always false.
        // It exists so the template's 'video-watched' class binding does not trigger an undefined-property warning.
        hasWatched() {
            return false;
        },
        isPlaceholder() {
            return this.data.type === "placeholder";
        },
        isCertain() {
            return !this.isPlaceholder || this.data.certainty === "certain";
        },
        title() {
            if (this.isPlaceholder) {
                if (useSettingsStore().nameProperty === "english_name") {
                    const title = this.data.title ?? this.data.jp_name ?? "";
                    return decodeHTMLEntities(title);
                }
                const title = this.data.jp_name ?? this.data.title ?? "";
                return decodeHTMLEntities(title);
            }
            if (!this.data.title) return "";
            return decodeHTMLEntities(this.data.title);
        },
        lang() {
            return useSettingsStore().lang;
        },
        formattedTime() {
            switch (this.data.status) {
                case "upcoming":
                    // A scheduled stream with no start time (start_scheduled) has no known start yet.
                    // The backend backfills available_at with published_at (when the scheduled stream was
                    // created, i.e. in the past), so treating it as the start time would make formatDistance
                    // see a past time and wrongly show "starting soon". Show such streams as start-undecided,
                    // together with the date the scheduled stream was created (published_at).
                    if (!this.data.start_scheduled) {
                        // Use the same locale-dependent short date format "l" as the existing display (diff_future_date).
                        return this.$t("time.start_undecided", [
                            localizedDayjs(this.data.published_at, this.lang).format("l"),
                        ]);
                    }
                    // print relative time in hours if less than 24 hours,
                    // print full date if greater than 24 hours
                    return formatDistance(
                        this.data.start_scheduled,
                        this.lang,
                        this.$t.bind(this),
                        false, // allowNegative = false
                        dayjs(this.now),
                    ); // upcoming videos don't get to be ("5 minutes ago")
                case "live":
                    return this.$t("component.videoCard.liveNow");
                default:
                    return formatDistance(
                        this.data.available_at,
                        this.lang,
                        this.$t.bind(this),
                    );
            }
        },
        shouldShowPlaceholderOverlay() {
            return this.isPlaceholder
                && (this.data.status === "upcoming" && this.data.placeholderType);
        },
        placeholderText() {
            if (this.data.placeholderType === "scheduled-yt-stream") {
                return this.$t("component.videoCard.typeScheduledYT");
            } if (this.data.placeholderType === "external-stream") {
                return this.$t("component.videoCard.typeExternalStream");
            } if (this.data.placeholderType === "event") {
                return this.$t("component.videoCard.typeEventPlaceholder");
            }
            return "";
        },
        hasDuration() {
            return (
                (this.data.duration > 0 && this.data.status === "live")
                || this.data.start_actual
            );
        },
        absoluteTimeString() {
            return titleTimeString(this.data.available_at, this.lang);
        },
        videoTitle() {
            return this.title;
        },
        formattedDuration() {
            if (this.data.start_actual && this.data.status === "live") {
                return this.formatDuration(
                    dayjs(this.now).diff(dayjs(this.data.start_actual)),
                );
            }
            if (this.data.status === "upcoming" && this.data.duration) {
                return this.$t("component.videoCard.premiere");
            }
            return (
                this.data.duration && this.formatDuration(this.data.duration * 1000)
            );
        },
        imageSrc() {
            // Use the thumbnail URL returned by the server as is (i.ytimg.com for YouTube, the Helix thumbnail for Twitch).
            if (this.data.thumbnail) return this.data.thumbnail;
            // Fallback: build it from the YouTube videoId
            if (this.data.channel?.platform !== "twitch") {
                const useWebP = useSettingsStore().canUseWebP && !this.forceJPG;
                const srcs = getVideoThumbnails(this.data.id, useWebP);
                if (this.horizontal) return srcs.medium;
                return srcs.standard;
            }
            return "";
        },
        redirectMode() {
            return useSettingsStore().redirectMode;
        },
        shouldHideThumbnail() {
            return useSettingsStore().hideThumbnail || this.hideThumbnail;
        },
        channelName() {
            const prop = useSettingsStore().nameProperty;
            return this.data.channel[prop] || this.data.channel.name;
        },
        isMobile() {
            return useRootStore().isMobile;
        },
        isFavorited() {
            return useFavoritesStore().isFavorited(this.data.channel?.id);
        },
        // MultiView always navigates to the external site (YouTube/Twitch).
        externalUrl() {
            const ch = this.data.channel || {};
            if (ch.platform === "twitch") {
                return `https://www.twitch.tv/${ch.id}`;
            }
            return `https://www.youtube.com/watch?v=${this.data.id}`;
        },
        watchLink() {
            return this.externalUrl;
        },
        channelUrl() {
            const ch = this.data.channel || {};
            if (ch.platform === "twitch") {
                return `https://www.twitch.tv/${ch.id}`;
            }
            return `https://www.youtube.com/channel/${ch.id}`;
        },
        hasTLs() {
            const lang = useSettingsStore().liveTlLang;
            return (
                (this.data?.status === "past" && this.data?.live_tl_count?.[lang])
                || this.data?.recent_live_tls?.includes(lang)
            );
        },
        tlLangInChat() {
            const lang = useSettingsStore().liveTlLang;
            return this.hasTLs && this.data.status === "past"
                ? `${this.data.live_tl_count[lang]}`
                : "";
        },
        tlIconTitle() {
            return this.data.status === "past"
                ? this.$t("component.videoCard.totalTLs")
                : this.$t("component.videoCard.tlPresence");
        },
        songIconTitle() {
            return this.$t("component.videoCard.totalSongs");
        },
        songCount() {
            return this.data.songcount > 1 ? this.data.songcount : "";
        },
        href() {
            if (this.isPlaceholder) return undefined;
            return this.externalUrl;
        },
        twitchPlaceholder() {
            return this.data.link?.includes("twitch.tv");
        },
        twitterPlaceholder() {
            return this.data.link?.includes("/i/spaces/");
        },
        inMultiViewActiveVideos() {
            if (!this.inMultiViewSelector) return false;
            const { id } = this.data;
            return useMultiviewStore().activeVideos.some((video) => video.id === id);
        },
    },
    // created() {
    //     this.data = this.video || this.source;
    // },
    created() {
        if (!this.updatecycle && this.data.status === "live") {
            this.updatecycle = setInterval(this.updateNow, 1000);
        }
    },
    activated() {
        if (!this.updatecycle && this.data.status === "live") {
            this.updatecycle = setInterval(this.updateNow, 1000);
        }
    },
    deactivated() {
        if (this.updatecycle) {
            clearInterval(this.updatecycle);
            this.updatecycle = null;
        }
    },
    beforeUnmount() {
        if (this.updatecycle) {
            clearInterval(this.updatecycle);
            this.updatecycle = null;
        }
    },
    methods: {
        formatDuration,
        formatCount,
        formatDistance,
        // In MultiView a click opens the external site. In the multiview selector and similar places,
        // disableDefaultClick=true makes it emit only the videoClicked event.
        goToVideo(e) {
            this.$emit("videoClicked", this.data);
            if (this.disableDefaultClick) {
                e.preventDefault();
            }
            // Otherwise the browser opens a new tab via this anchor's own href. Calling window.open
            // here as well would open the stream twice.
        },
        onThumbnailClicked(e) {
            this.$emit("videoClicked", this.data);
            if (this.disableDefaultClick) {
                e.preventDefault();
                return;
            }
            // The browser opens a new tab via the href, so nothing more is needed here
        },
        toggleFavorite(event) {
            event.preventDefault();
            const ch = this.data.channel;
            if (!ch) return;
            useFavoritesStore().toggleFavorite({ id: ch.id, name: ch.name });
        },
        updateNow() {
            this.now = Date.now();
        },
        drag(ev) {
            ev.dataTransfer.setData("text", this.externalUrl);
            ev.dataTransfer.setData("application/json", JSON.stringify(this.data));
        },
    },
};
</script>

<style scoped lang="scss">
.v-theme--light .video-watched {
  color: rgb(var(--v-theme-secondary)) !important;
}

.v-theme--dark .video-watched {
  color: rgb(var(--v-theme-secondary)) !important;
  opacity: 0.6;
}

.video-card-fluid {
  width: 100%;
}

.text-live {
  color: red;
  font-weight: 500;
}
.video-card-text {
  min-height: 88px;
  position: relative;
}

/* https://css-tricks.com/almanac/properties/w/word-break/ */
.video-card-lines div {
  line-height: 1.2;
  /* padding-bottom: 0.2rem; */
  margin-bottom: 2px;
  flex-grow: 1;
  justify-content: space-around;
}
.video-card-title {
  line-height: 1.25rem !important;
  max-height: 2.5rem;

  white-space: normal;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  word-break: break-word;

  -webkit-hyphens: auto;
  -moz-hyphens: auto;
  hyphens: auto;

  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  padding-right: 22px;
}

.channel-name {
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  white-space: initial;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  display: -webkit-box;
}

.channel-name > a:hover {
  color: black !important;
}
.v-theme--dark .channel-name > a:hover {
  color: white !important;
}

.video-card .hover-show {
  visibility: hidden;
}

.video-card:hover .hover-show {
  visibility: visible;
}

.video-card .hover-placeholder {
  visibility: hidden;
  display: none;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card:hover .hover-placeholder {
  visibility: visible;
  display: inline-block;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card .duration-placeholder {
  visibility: visible;
  display: inline-block;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card:hover .duration-placeholder {
  visibility: hidden;
  display: none;
  line-height: 13px;
  position: relative;
  top: 1px;
}

.video-card .hover-opacity {
  opacity: 0.6;
}
.video-card:hover .hover-opacity {
  opacity: 1;
}

.video-duration {
  background-color: rgba(0, 0, 0, 0.8);
  margin: 2px;
  padding: 2px 5px;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  line-height: 0.81rem;

  &.video-duration-live {
    background-color: rgba(148, 0, 0, 0.8);
  }
}

.video-topic {
  background-color: rgba(0, 0, 0, 0.8);
  margin: 2px;
  padding: 1px 5px;
  text-align: center;
  font-size: 0.8125rem;
  letter-spacing: 0.025em;
  text-transform: capitalize;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.video-card-action {
  background-color: rgba(0, 0, 0, 0.8);
  padding: 2px;
  margin: 2px;
}

.video-card-horizontal {
  flex-direction: row !important;

  .video-thumbnail {
    margin-right: 5px;
    width: 150px !important;
  }

  .video-card-text {
    .video-card-lines {
      justify-content: space-around;
    }
  }
}

.video-card-list {
  flex-direction: row !important;
  min-height: 40px;
  .video-card-text {
    min-height: auto;
    align-items: center;
    .video-card-lines {
      margin-right: 40px;
      flex-direction: row !important;
      flex-wrap: wrap;
      width: 100%;
      justify-content: flex-start;
      align-items: center;
      .video-card-title {
        flex-basis: 50%;
      }
      .channel-name.video-card-subtitle {
        flex-basis: 200px;
      }
      .video-card-subtitle:last-of-type {
        flex-basis: 150px;
      }
    }
  }
}

.name-vtuber {
  color: #42a5f5 !important;
}

.video-card-active {
  /* primary color with opacity */
  /* background-color: #f0629257; */
  height: auto;
  width: auto;
  position: relative;
}

.video-card-active::before {
  content: "";
  background-color: rgb(var(--v-theme-primary));
  background-size: cover;
  position: absolute;
  top: -1px;
  right: -1px;
  bottom: -1px;
  left: -1px;
  opacity: 0.15;
  border-radius: 4px;
}

.video-card-multiview-active .video-thumbnail,
.video-card-multiview-active .video-card-title {
  filter: grayscale(1);
  opacity: 0.3;
}

.video-card-subtitle {
  line-height: 1.2;
  font-size: 0.875rem;
  /* Follow the Vuetify 3 theme text color (previously: fixed white plus a theme--light override. Vuetify 3
     does not add the theme--light class, so the text would stay white; use on-surface + medium-emphasis). */
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}
.v-theme--light .video-card-subtitle {
  color: rgba(0, 0, 0, 0.6);
}
.video-card-menu {
  position: absolute;
  right: 0px;
  display: inline-block;
  top: 5px;
  z-index: 1;
}
.plain-button:before {
  display: none;
}
.plain-button:hover:before {
  background-color: transparent;
}
</style>
