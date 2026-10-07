<template>
  <div>
    <!-- Vuetify 3 removed the clipped-* props. Registering the app-bar before the drawer lets the
         app-bar take the full width at the top, with the drawer clipped below it (like Vuetify 2's clipped-left).
         So the app-bar is placed before the drawer. -->
    <!-- Vuetify 3's v-app-bar still reserves its height in v-main's --v-layout-top under v-show (display:none).
         When hiding it (e.g. in multiview), remove it completely with v-if, or a 56px gap is left at the top. -->
    <v-app-bar
      v-if="showTopBar"
      id="top-bar"
      :class="{
        'bg-secondary-darken-1': darkMode,
        'bg-primary-lighten-1': !darkMode,
      }"
      flat
      extension-height="36"
      height="56"
    >
      <template v-if="!isMobile || (isMobile && !searchBarExpanded)">
        <v-app-bar-nav-icon @click.stop="navDrawer = !navDrawer; navbarExpanded = false">
          <v-icon>{{ icons.mdiMenu }}</v-icon>
        </v-app-bar-nav-icon>
        <v-toolbar-title style="overflow: visible" :class="{ 'pa-0': isMobile }">
          <!-- color: inherit makes the logo take the app bar's text color instead of the link color. -->
          <router-link :to="{ name: defaultOpen || '/' }" style="color: inherit">
            <Logo
              v-if="!isMobile"
              width="24"
              height="24"
              style="margin-bottom: -4px"
            />
          </router-link>
        </v-toolbar-title>
        <!-- Vuetify 3: position the search bar absolutely at the center of the full app-bar width. With flex +
             margin:auto or a spacer it shifts right by the width of the left side (nav-icon/title), so center it
             absolutely, independent of the left/right content (the same look as upstream Holodex). -->
        <div v-if="!isMobile" class="search-center-wrap">
          <SearchBar key="main-search-bar" />
        </div>

        <v-btn v-if="isMobile" icon class="ml-auto" @click="searchBarExpanded = true">
          <v-icon>{{ icons.mdiMagnify }}</v-icon>
        </v-btn>
      </template>

      <template v-else>
        <v-app-bar-nav-icon class="backButton" @click="searchBarExpanded = false">
          <v-icon>{{ icons.mdiClose }}</v-icon>
        </v-app-bar-nav-icon>
        <SearchBar key="main-search-bar" :autofocus="isMobile" />
      </template>

      <div
        :class="{
          'bg-secondary-darken-3': darkMode,
          'bg-primary-lighten-1': !darkMode,
        }"
        style="
          position: absolute;
          top: calc(-1 * env(safe-area-inset-top));
          left: 0px;
          right: 0px;
          width: 100%;
          height: env(safe-area-inset-top);
          z-index: 300;
        "
      />

      <span v-if="!disableExt" v-scroll="onScroll" />
      <!-- The mainNavExt portal was inherited from the fork and was always empty because nothing sent to it (no <portal to>), so it was removed -->
      <template v-if="!disableExt && showExt" #extension>
        <v-slide-y-transition />
      </template>
    </v-app-bar>

    <!-- Make the drawer temporary in multiview (a permanent drawer stays open on desktop even with
         v-model=false; this corresponds to upstream Holodex's isMobile || isWatchPage).
         Placing it after the app-bar leaves the top edge to the app-bar (the equivalent of clipped). -->
    <NavDrawer
      v-model="navDrawer"
      :pages="pages"
      :temporary="isMobile || isMultiView"
      :expand="navbarExpanded"
      @expand="navbarExpanded = !navbarExpanded"
    />

    <BottomNav v-if="isMobile" :key="$route.path" :pages="pages.filter((page) => !page.collapsible)" />
  </div>
</template>

<script lang="ts">
import SearchBar from "@/components/common/SearchBar.vue";
import Logo from "@/components/common/Logo.vue";
import { mapState } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import hideExtensionOnScroll from "@/mixins/hideExtensionOnScroll";
import NavDrawer from "./NavDrawer.vue";
import BottomNav from "./BottomNav.vue";

export default {
    components: {
        SearchBar,
        NavDrawer,
        BottomNav,
        Logo,
    },
    mixins: [hideExtensionOnScroll],
    data() {
        return {
            searchBarExpanded: false,
            navbarExpanded: false,
        };
    },
    computed: {
        showTopBar() {
            if (this.isMultiView) return false;
            return true;
        },
        isMobile() {
            return useRootStore().isMobile;
        },
        darkMode() {
            return useSettingsStore().darkMode;
        },
        defaultOpen() {
            return useSettingsStore().defaultOpen;
        },
        isMultiView() {
            return this.$route.name === "multiview";
        },
        navDrawer: {
            get() {
                return useRootStore().navDrawer;
            },
            set(val) {
                useRootStore().setNavDrawer(val);
            },
        },
        pages() {
            return [
                {
                    name: this.$t("component.mainNav.home"),
                    path: "/",
                    icon: this.icons.mdiHome,
                },
                {
                    name: this.$t("component.mainNav.favorites"),
                    path: "/favorites",
                    icon: this.icons.mdiHeart,
                },
                {
                    name: this.$t("component.mainNav.multiview"),
                    path: "/multiview",
                    icon: this.icons.mdiViewDashboard,
                },
                {
                    name: this.$t("component.mainNav.channels"),
                    path: "/channels",
                    icon: this.icons.mdiAccountBoxMultiple,
                },
                {
                    name: this.$t("component.mainNav.settings"),
                    path: "/settings",
                    icon: this.icons.mdiCog,
                    collapsible: true,
                },
            ];
        },
        ...mapState(["firstVisit"]),
    },
    watch: {
        // Switch the drawer's default visibility on page navigation (desktop).
        // Multiview: closed / anything else: open. Corresponds to upstream Holodex's isWatchPage watcher.
        isMultiView() {
            if (this.isMobile) return;
            this.navDrawer = !this.isMultiView;
        },
        isMobile() {
            this.navDrawer = false;
        },
    },
    created() {
        const rootStore = useRootStore();
        if (rootStore.firstVisit) {
            setTimeout(() => {
                rootStore.setVisited();
            }, 30000);
        }

        if (
            !window.location.pathname.match("^/multiview")
            && !this.isMobile
            && !this.$vuetify.display.md
        ) {
            this.navDrawer = true;
        }
    },
};
</script>

<style scoped>
#top-bar {
    padding-left: min(calc(env(safe-area-inset-left)), 30px);
    padding-right: min(calc(env(safe-area-inset-right)), 30px);
    padding-top: 0px;
    margin-top: env(safe-area-inset-top, 0px) !important;
}
#top-bar.v-toolbar--extended {
    height: 56px !important;
}

/* Position the search bar absolutely at the center of the full app-bar width (independent of the left/right content widths). */
.search-center-wrap {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 100%;
    /* Upstream Holodex's .search-bar has max-width:670px. Match that on the wrapper too, and do not
       shrink the inside with padding (that would make it shorter than upstream). */
    max-width: 670px;
    display: flex;
    justify-content: center;
    /* Let events pass through the empty areas so clicks on the nav-icon etc. are not blocked */
    pointer-events: none;
}
.search-center-wrap > * {
    pointer-events: auto;
    width: 100%;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s ease;
}
.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>
