<template>
  <!-- Vuetify 3: v-model is model-value/update:model-value. The app/clipped props were removed (the layout
       is determined by the DOM order of the app-bar and drawer). -->
  <v-navigation-drawer
    :model-value="modelValue"
    width="220"
    class="nav-scroll"
    :temporary="temporary"
    style="padding-top: env(safe-area-inset-top); padding-left: calc(env(safe-area-inset-left) / 1.3)"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <slot />
    <!-- The Vuetify 3 equivalent of upstream Holodex's Vuetify 2 `dense` (item height ~40px) is comfortable.
         compact (32px) is too tight, so use comfortable. -->
    <v-list density="comfortable" class="pb-0">
      <!-- <v-list> -->
      <template v-for="page in pages.filter(e => !e.extra)" :key="page.name">
        <v-list-item
          link
          :href="page.path"
          :class="{ 'v-list-item--active': $route.fullPath === page.path }"
          @click="(e) => handlePageClick(page, e)"
        >
          <template #prepend>
            <v-icon>{{ page.icon }}</v-icon>
          </template>
          <v-list-item-title v-html="page.name" />
          <!-- Quick Settings Popup -->
          <template v-if="page.path === '/settings' && $vuetify.display.smAndUp" #append>
            <v-menu
              v-model="showSettings"
              location="end"
              max-height="80vh"
              :close-on-content-click="false"
            >
              <template #activator="{ props }">
                <v-icon v-bind="props" @click.stop.prevent>
                  {{ mdiTuneVariant }}
                </v-icon>
              </template>
              <v-card rounded="lg" class="py-n2 scrollable">
                <settings slim @close="showSettings = false" />
              </v-card>
            </v-menu>
          </template>
        </v-list-item>
        <v-divider v-if="page.divider" />
      </template>
      <!-- Expanded part -->
      <v-divider v-if="expand" />

      <template v-if="expand">
        <v-list-item
          v-for="page in pages.filter(e => e.extra)"
          :key="page.name"
          link
          :href="page.path"
          :class="{ 'v-list-item--active': $route.fullPath === page.path }"
          @click="(e) => handlePageClick(page, e)"
        >
          <template #prepend>
            <v-icon>{{ page.icon }}</v-icon>
          </template>
          <v-list-item-title v-html="page.name" />
        </v-list-item>
      </template>
      <!-- </v-list> -->
    </v-list>
    <v-divider />
    <div class="d-flex justify-center">
      <v-btn
        icon
        size="x-small"
        variant="text"
        @click="$emit('expand', {});"
      >
        <v-icon>{{ expand ? mdiChevronUp : mdiChevronDown }}</v-icon>
      </v-btn>
    </div>
    <v-list density="comfortable">
      <v-list-subheader class="pl-5 text-overline">
        {{ $t("component.mainNav.favorites") }}
      </v-list-subheader>
      <template v-for="vid in collapsedFavorites" :key="vid.key">
        <v-list-item
          v-if="vid"
          @click="$router.push('/favorites').catch(() => {})"
        >
          <template #prepend>
            <div class="nav-fav-avatar mr-3" :class="{ outlined: isLive(vid) }">
              <ChannelImg :channel="vid.channel" :size="30" />
            </div>
          </template>
          <ChannelInfo :channel="vid.channel" no-subscriber-count no-group />
          <template v-if="isLive(vid)" #append>
            <div :key="'liveclock' + vid.key + tick" class="ch-live">
              LIVE
            </div>
          </template>
        </v-list-item>
      </template>
      <v-list-item v-if="favorites.length > 8" link @click="favoritesExpanded = !favoritesExpanded">
        <template #prepend>
          <v-icon>{{ favoritesExpanded ? icons.mdiChevronUp : icons.mdiChevronDown }}</v-icon>
        </template>
        <v-list-item-title>
          {{ favoritesExpanded ? $t("views.favorites.close") : $t("views.favorites.showall") }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
    <!-- Footer (pinned to the bottom): site name and custom links (optional) plus the language selector -->
    <div id="nav-footer">
      <!-- Site name and links set by the operator in config.yaml (hidden when not set) -->
      <v-sheet
        v-if="siteName || siteLinks.length"
        class="text-grey d-flex align-center flex-wrap px-2 py-1"
        style="gap: 6px"
      >
        <small v-if="siteName" class="one-liner" style="font-size: 0.75rem">{{ siteName }}</small>
        <a
          v-for="link in siteLinks"
          :key="link.url"
          :href="link.url"
          :title="link.label"
          target="_blank"
          rel="noopener noreferrer"
          class="d-inline-flex align-center"
        >
          <v-icon size="small" color="grey">{{ resolveIcon(link.icon) }}</v-icon>
        </a>
      </v-sheet>
      <v-sheet id="bottom-bar" class="text-grey mb-0">
      <v-icon size="x-small" color="grey" class="ml-auto">
        {{ icons.mdiEarth }}
      </v-icon>
        <router-link to="/settings" class=" one-liner">
          <small class="pl-1" style="font-size: 0.7rem">{{ language }}</small>
        </router-link>
      </v-sheet>
    </div>
  </v-navigation-drawer>
</template>

<script lang="ts">
import ChannelImg from "@/components/channel/ChannelImg.vue";
import ChannelInfo from "@/components/channel/ChannelInfo.vue";
import { langs } from "@/plugins/vuetify";
import { dayjs, formatDurationShort, titleTimeString } from "@/utils/time";
import { mdiTuneVariant, mdiPatreon, mdiChevronUp, mdiChevronDown, mdiLinkVariant } from "@mdi/js";
import * as curatedIcons from "@/utils/icons";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { useHomeStore } from "@/store/home.store";
import { useFavoritesStore } from "@/store/favorites.store";
import Settings from "@/views/Settings.vue";

export default {
    name: "NavDrawer",
    components: {
        ChannelImg,
        ChannelInfo,
        Settings,
    },
    props: {
        pages: {
            required: true,
            type: Array,
        },
        expand: {
            type: Boolean,
            default: false,
        },
        modelValue: {
            type: Boolean,
            default: false,
        },
        temporary: {
            type: Boolean,
            default: false,
        },
    },
    emits: ["update:modelValue", "expand"],
    data() {
        return {
            favoritesExpanded: false,
            tick: Date.now(),
            ticker: null,
            showSettings: false,

            mdiTuneVariant,
            mdiPatreon,
            mdiChevronDown,
            mdiChevronUp,
        };
    },
    computed: {
        // ...mapState("favorites", ["favorites", "live"]),
        // Site name and custom links set by the operator in config.yaml ("" / [] when not set)
        siteName() {
            return useSettingsStore().siteName;
        },
        siteLinks() {
            return useSettingsStore().siteLinks || [];
        },
        language() {
            return langs.find((x) => x.val === useSettingsStore().lang).display;
        },
        favorites() {
            // List of favorite channels. A channel is shown as LIVE when home.live has a live stream for it.
            const fav = useFavoritesStore().favorites || [];
            const lives: Array<any> = useHomeStore().live || [];
            const liveChannelIds = new Set(
                lives.filter((x) => x.status === "live").map((x) => x.channel.id),
            );
            // ChannelImg looks the icon up in the home.channels map, so there is no need to attach it here.
            return fav
                .map((ch) => ({
                    channel: ch,
                    status: liveChannelIds.has(ch.id) ? "live" : "upcoming",
                    key: ch.id,
                }))
                .sort((a, b) => {
                    const name1 = a.channel.name || "";
                    const name2 = b.channel.name || "";
                    return name1.localeCompare(name2);
                });
        },
        collapsedFavorites() {
            return !this.favoritesExpanded && this.favorites.length > 8 ? this.favorites.slice(0, 8) : this.favorites;
        },
    },
    created() {
        if (!this.ticker) {
            this.ticker = setInterval(() => {
                this.tick = Date.now();
            }, 60000);
        }
    },
    beforeUnmount() {
        if (this.ticker) clearInterval(this.ticker);
    },
    methods: {
        // Resolve site_links[].icon from config.yaml (an mdi name such as "mdiTwitter") to the actual icon.
        // Importing all of mdi would bloat the bundle, so only the icons included in utils/icons.js are supported.
        // Falls back to a generic link icon when the name is missing or not included.
        resolveIcon(name) {
            return (name && curatedIcons[name]) || mdiLinkVariant;
        },
        handlePageClick(page, event) {
            // reload the page if user clicks on the same tab
            if (page.path.startsWith("https://")) return;
            event.preventDefault();
            page.path === this.$route.path && !this.$route.query.page
                ? this.refresh()
                : this.$router.push({ path: page.path });
        },
        async refresh() {
            // here to fetch the data and rerender the contents.
            // check if there's a handler on the sequence
            const handledRefresh = await useRootStore().reloadCurrentPage({
                source: "ptr",
                consumed: false,
            });
            // do default refresh if none
            if (!handledRefresh.consumed) {
                this.$router.go(0);
            }
        },
        formatDurationUpcoming(ts) {
            const secs = dayjs(ts).diff(dayjs()) / 1000;
            return formatDurationShort(Math.abs(secs));
        },
        absoluteTimeString(video) {
            return titleTimeString(video.available_at);
        },
        isLive(video) {
            return video.status === "live";
        },
        // getChannelLiveAtTime,
    },
};
</script>

<style>
/* Pin the whole footer (site name, links, and language) to the bottom.
   The drawer's content is not a flex column, so mt-auto has no effect; stick it to the bottom with absolute. */
#nav-footer {
  position: absolute;
  width: 100%;
  bottom: 0;
  /* Same as upstream Holodex: background lighten1 for the background, lighten2 for the border. */
  background-color: rgb(var(--v-theme-background-lighten-1));
  border-top: 1px solid rgb(var(--v-theme-background-lighten-2));
}

#bottom-bar {
  font-size: 0.8rem;
  width: 100%;
  background-color: rgb(var(--v-theme-background-lighten-1));
  align-items: center;
  display: flex;
  padding: 3px 16px;
}

.one-liner {
  white-space: normal;
  overflow: hidden;
  text-overflow: clip;
  word-break: break-all;

  display: -webkit-inline-box;
  line-clamp: 1;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}

.nav-scroll > .v-navigation-drawer__content {
    scrollbar-width: thin; /* firefox fall back */
}

.nav-scroll > .v-navigation-drawer__content::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}

.nav-scroll > .v-navigation-drawer__content::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.1);
}

.nav-scroll > .v-navigation-drawer__content::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.5);
}

.nav-scroll > .v-navigation-drawer__content:hover {
    overflow-y: auto !important; /* firefox fallback */
    overflow-y: overlay !important;
}

/* overflow-y: overlay does not work on temporary drawer */
.nav-scroll.v-navigation-drawer--temporary > .v-navigation-drawer__content {
    overflow-y: auto !important;
}

.nav-scroll > .v-navigation-drawer__content {
    overflow-y: hidden !important;
    /* Upstream Holodex uses a dark color slightly lighter than the background (background lighten1).
       Use the derived background-lighten-1 rather than Vuetify 3's (lighter) surface. */
    background-color: rgb(var(--v-theme-background-lighten-1));
}

.nav-fav-avatar {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    overflow: hidden;
    flex: 0 0 auto;
}
.outlined {
    position: relative;
    box-shadow: 0 0 0 2px red, 0 0 4px 3px rgba(255, 0, 0, 0.56);
}
.ch-live {
    /* font-size: large; */
    color: red;
}
.ch-upcoming {
    font-size: small;
    line-height: 24px;
}
.trapezoid {
  width: 230px;
  text-align: center;
  height: 0;
  position: relative;
  border-right: 50px solid transparent;
  border-top: 40px solid #2963BD;
  border-left: 50px solid transparent;
  box-sizing: content-box;
}
</style>
