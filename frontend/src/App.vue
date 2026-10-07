<template>
  <v-app
    :style="{ background: $vuetify.theme.themes[darkMode ? 'dark' : 'light'].colors.background }"
  >
    <MainNav />

    <v-main style="transition: none">
      <PullToRefresh />
      <!--
        MultiView must not be cached by keep-alive, but excluding it is not enough: Vue 3's
        keep-alive still patches an excluded child twice, so mounted runs twice on the live
        instance (a regression from Vue 2, and the root cause of the shared-URL overwrite
        confirmation dialog appearing twice). Since exclude only prevents caching and cannot
        stop the double mounted, MultiView is rendered by a plain router-view outside
        keep-alive, which avoids the duplicate creation altogether.
      -->
      <router-view v-if="$route.path.startsWith('/multiview')" :key="viewKey" />
      <keep-alive
        v-else
        max="4"
        exclude="Watch,MugenClips,EditVideo,Channel,Playlists,About"
      >
        <router-view :key="viewKey" />
      </keep-alive>
    </v-main>
  </v-app>
</template>

<script lang="ts">
import MainNav from "@/components/nav/MainNav.vue";
import PullToRefresh from "@/components/common/PullToRefresh.vue";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { useHomeStore } from "@/store/home.store";
import { loadLanguageAsync } from "./plugins/vuetify";
import api, { axiosInstance } from "./utils/backend-api";
import { siteTitle } from "./utils/site";

export default {
    name: "App",
    // default meta info ("MultiView" when site_name is not set)
    head() {
        return {
            title: siteTitle(),
        };
    },
    components: {
        MainNav,
        PullToRefresh,
    },
    data() {
        return {
            needRefresh: false,
            liveUpdateTask: null,
        };
    },
    computed: {
        rootStore() {
            return useRootStore();
        },
        viewKey() {
            return this.$route.path;
        },
        darkMode() {
            return useSettingsStore().darkMode;
        },
        lang() {
            // connected to the watch.lang hook below.
            return this.$route.query.lang || useSettingsStore().lang;
        },
        visibilityState() {
            return this.rootStore.visibilityState;
        },
    },
    watch: {
        darkMode() {
            this.$vuetify.theme.global.name = this.darkMode ? "dark" : "light";
        },
        lang(v) {
            // watches the computed.lang variable and updates vue I18N
            // import(`dayjs/locale/${this.lang}`) // ES 2015
            loadLanguageAsync(v);
        },
        // watches change in breakpoint from vuetify and updates store
        // eslint-disable-next-line func-names
        "$vuetify.display.name": function () {
            this.updateIsMobile();
        },
        visibilityState() {
            console.log(`App became ${this.visibilityState}`);
            if (this.visibilityState === "visible") {
                useHomeStore().fetchLive({ force: false, minutes: 5 });
            }
        },
        // eslint-disable-next-line func-names
        "$vuetify.theme.themes.dark.colors": {
            handler() {
                // set theme-color
                this.syncThemeColor();
            },
            deep: true,
        },
    },
    async created() {
        this.rootStore.setVisiblityState(document.visibilityState);
        document.addEventListener("visibilitychange", () => {
            this.rootStore.setVisiblityState(document.visibilityState);
        });
        axiosInstance.interceptors.response.use(undefined, this.interceptError);

        // Fetch the server's public config (public_refresh_enabled / site_name / site_links)
        api.publicConfig()
            .then((cfg) => {
                useSettingsStore().setPublicConfig({
                    publicRefreshEnabled: cfg.public_refresh_enabled,
                    siteName: cfg.site_name,
                    siteLinks: cfg.site_links,
                });
            })
            .catch((e) => console.error("failed to load public config", e));

        // Fetch the list of registered channels (including icons); used to show icons for favorites.
        useHomeStore().fetchChannels();

        // set theme (Vuetify 3 switches the active theme via global.name)
        this.$vuetify.theme.global.name = this.darkMode ? "dark" : "light";
        this.syncThemeColor();

        // Set isMobile from the current breakpoint.
        // Note: this must run before any await (i.e. before the child components' created hooks).
        //   created runs parent first, then children, so unless isMobile is set synchronously
        //   here, the child MainNav reads its default value (true) and the drawer does not
        //   open initially even on desktop. Upstream Holodex has no await in created, so this
        //   was always set before the children; adding await loadLanguageAsync had broken that.
        this.updateIsMobile();

        // The locale is already set by loadLanguageAsync in main.ts before mounting, so it is not
        // set here (awaiting here would split created and let child components read stale state).

        if (this.liveUpdateTask) clearInterval(this.liveUpdateTask);

        this.liveUpdateTask = setInterval(() => {
            useHomeStore().fetchLive({ minutes: 5 });
        }, 6 * 60 * 1000);

        setTimeout(() => {
            useHomeStore().fetchLive({ force: false, minutes: 2 });
        }, 5000);
    },
    beforeUnmount() {
        if (this.liveUpdateTask) clearInterval(this.liveUpdateTask);
    },
    methods: {
        updateIsMobile() {
            this.rootStore.setIsMobile(
                ["xs", "sm"].includes(this.$vuetify.display.name),
            );
        },
        interceptError(error) {
            // Any status codes that falls outside the range of 2xx cause this function to trigger
            // Do something with response error
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                console.error(error.response.data);
                console.error(error.response.status);
                console.error(error.response.headers);
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.error(error);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error("Error", error.message);
            }
            // Force clear cache
            // fetch(error.config.url, { method: "post" }).then(() => {});
            return Promise.reject(error);
        },
        syncThemeColor() {
            const themeColor = this.$vuetify.theme.themes.dark.colors.secondary;
            window.document.head.querySelector<HTMLMetaElement>(
                "meta[name=theme-color]",
            ).content = themeColor;
        },
    },
};
</script>
<style>
.no-decoration {
  text-decoration: none;
  color: inherit !important;
}

html {
  overflow-y: auto;
}

body {
  overscroll-behavior-y: contain;
  /* Flicker mitigation: in MultiView the body background shows through for a moment when
     the browser tab becomes active again or while the grid/iframes repaint. The body used
     to be fixed black, so those gaps appeared as a black flash. Follow the theme background
     color so that any gap shows the base color (dark or light) and goes unnoticed. */
  background: rgb(var(--v-theme-background));
  padding-left: min(calc(env(safe-area-inset-left)), 30px);
  padding-right: min(calc(env(safe-area-inset-right)), 30px);
  scrollbar-width: thin;
}
div.row {
  margin: 0px -12px;
}

/* App-wide: Vuetify 3's inset v-switch has a darker on-track (0.6) and a pale purple thumb
   (rgb(204,191,214)) by default, unlike upstream Holodex (Vuetify 2), which shows a
   primary-colored thumb on a faint primary track. Match upstream for every switch in the
   app (on = primary fill, off = grey, track opacity 0.32).
   In Vuetify 2 the off state was
     dark  : thumb rgb(189,189,189) / track rgba(255,255,255,0.3)
     light : thumb rgb(255,255,255) / track rgba(0,0,0,0.38)
   An earlier fix applied only fixed dark-theme values (thumb 189 / track grey #424242),
   which left the off thumb grey and the track dark grey in the light theme, where they
   looked out of place. The off state is therefore set per theme. */
.v-switch .v-switch__track {
  opacity: 0.32;
}
.v-switch .v-selection-control--dirty .v-switch__thumb {
  background-color: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-primary));
}
/* Off thumb: grey in dark / white in light (matches Vuetify 2) */
.v-switch .v-selection-control:not(.v-selection-control--dirty) .v-switch__thumb {
  background-color: rgb(189, 189, 189);
  color: rgb(189, 189, 189);
}
.v-theme--light .v-switch .v-selection-control:not(.v-selection-control--dirty) .v-switch__thumb {
  background-color: rgb(255, 255, 255);
  color: rgb(255, 255, 255);
}
/* Off track: whitish in dark / blackish in light (matches Vuetify 2); faint when combined with opacity 0.32. */
.v-switch .v-selection-control:not(.v-selection-control--dirty) .v-switch__track {
  background-color: rgba(255, 255, 255, 0.3);
}
.v-theme--light .v-switch .v-selection-control:not(.v-selection-control--dirty) .v-switch__track {
  background-color: rgba(0, 0, 0, 0.38);
}

/* App-wide (same root cause as the color difference in the lower part of the sync bar):
   Vuetify 3 draws the icon inside a flat (text/plain) icon button at full emphasis (0.87),
   whereas upstream Holodex (Vuetify 2) drew icons with no explicit color at medium
   emphasis (0.54). On the light theme (white background) the icons therefore look darker
   than before (home, favorites, settings, search, portal, etc.).
   So, only for light-theme text/plain icon buttons that have no color class (text-*),
   lower the default icon color to 0.54 to match upstream.
   - `:not([class*="text-"])` excludes colored buttons such as `text-primary`/`text-green`
     (the colored mv-toolbar actions, primary tabs, etc. stay as they are; this avoids a
     regression where every icon gets recolored).
   - elevated/filled buttons (with a background) are excluded by the variant selectors. */
.v-theme--light .v-btn--variant-text.v-btn--icon:not([class*="text-"]) .v-icon,
.v-theme--light .v-btn--variant-plain.v-btn--icon:not([class*="text-"]) .v-icon {
  color: rgba(0, 0, 0, 0.54);
}

/* App-wide: restore the open/close animation of modals (v-dialog) to match upstream Holodex
   (Vuetify 2). Vuetify 3's default dialog-transition only scales from 0.9 to 1 and its
   scrim opacity is a light 0.32, so it looks weaker than Vuetify 2's larger pop
   (scale 0.5 to 1) with a darker scrim (0.46). Confirmed by measuring the DOM:
   Vuetify 2 scale 0.5 / scrim 0.46 vs. Vuetify 3 scale 0.9 / scrim 0.32.
   No v-dialog sets transition or scrim, so they all share these defaults; the Vuetify 2
   values are therefore applied globally. */
/* 1) Use the Vuetify 2 scale amount (0.5) for open/close. Only the from/to states of
   dialog-transition are overridden. */
.dialog-transition-enter-from,
.dialog-transition-leave-to {
  transform: scale(0.5);
}
/* 2) Use the Vuetify 2 backdrop (scrim): color #212121, opacity 0.46.
   Do NOT override the scrim's opacity with a fixed value. Its resting opacity comes from
   .v-overlay__scrim{opacity:var(--v-overlay-opacity)}. Fixing opacity:.46 here would keep
   the fade below (keyframes / fade-transition) from starting at opacity 0 and break it.
   Instead, set the --v-overlay-opacity variable itself to .46 (default .32), which also
   keeps the resting state at .46 after the keyframes below finish. */
.v-overlay {
  --v-overlay-opacity: 0.46;
}
.v-overlay__scrim {
  background: rgb(33, 33, 33);
}
/* Root cause (confirmed from the Vuetify source and web research): the scrim is mounted
   and unmounted via v-if inside <Transition name="fade-transition" appear> in Scrim() of
   VOverlay.js. Vue's Transition performs enter in two steps: apply enter-from (opacity:0),
   then switch to enter-to on the next frame. In a real browser the enter-from frame does
   not get painted: enter-from and enter-to collapse into a single frame, so opacity:0 is
   never drawn and the scrim jumps straight to .46 (an abrupt darkening). Leave behaves
   the same way. This is a known pattern where Vue's Transition combined with a CSS
   transition skips the initial frame under real frame timing (the official Vue guidance
   points to @starting-style, and Josh Comeau's article says the same).
   Note: observing it with getComputedStyle/rAF forces a style recalculation that pins the
   starting point and makes it look smooth, so it cannot be reproduced with DOM dumps or
   Playwright. It was only observable by splitting a recording of the real screen into frames.

   Fix: use @keyframes instead of a CSS transition (which depends on the difference between
   two consecutive frames). Keyframes reliably start from `from` the moment the class is
   added and do not depend on an initial-frame difference, so nothing is skipped in a real
   browser (as Comeau recommends; used for both directions, mount and unmount).
   The keyframes are applied to the fade-transition-enter-active / leave-active classes
   that Vuetify adds. Duration and easing match the panel (dialog-transition). */
@keyframes scrim-fade-in  { from { opacity: 0; } to { opacity: 0.46; } }
@keyframes scrim-fade-out { from { opacity: 0.46; } to { opacity: 0; } }
.v-overlay__scrim.fade-transition-enter-active {
  animation: scrim-fade-in 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
  will-change: opacity;
}
.v-overlay__scrim.fade-transition-leave-active {
  animation: scrim-fade-out 0.35s cubic-bezier(0.4, 0, 0.2, 1) both;
  will-change: opacity;
}
/* Match the panel's (dialog-transition) duration to the scrim as well.
   Vuetify's defaults are asymmetric (enter 225ms / leave 125ms), so opening and closing
   run at different speeds; set both to 0.35s so that they move in step with the scrim
   keyframes (0.35s). */
.dialog-transition-enter-active,
.dialog-transition-leave-active {
  transition-duration: 0.35s !important;
}
</style>
