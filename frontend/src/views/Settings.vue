<template>
  <v-container :style="slim && 'max-width: 80vw; width:500px;'" :class="{ 'pa-0': slim }">
    <v-row dense>
      <v-col v-if="!slim" cols="12">
        <div class="text-h4 mb-2 ml-5 mt-2">
          {{ $t("views.settings.title") }}
        </div>
      </v-col>
      <v-col :cols="slim ? 12 : currentCol" :class="{'pt-3': slim}">
        <v-sheet class="settings-group" :class="{'my-0 py-0': slim}">
          <v-btn
            v-if="slim"
            class="float-right mt-n2"
            color="primary"
            variant="text"
            href="/settings"
            @click.stop.prevent="goToSettings($event)"
          >
            {{ $t('views.settings.moreSettings') }}
            <v-icon end size="small">
              {{ icons.mdiChevronRight }}
            </v-icon>
          </v-btn>
          <v-card-title class="py-1">
            <v-icon
              size="large"
              disabled
              start
              class="ml-n3"
            >
              {{ mdiEarth }}
            </v-icon>

            <span class="text-h6 font-weight-light">{{ $t("views.settings.languageSettings") }}</span>
          </v-card-title>
          <v-card-text class="pb-0">
            <v-select
              v-model="language"
              :items="langs"
              item-title="display"
              item-value="val"
              :prepend-icon="icons.mdiTranslate"
            >
              <template #item="{ item, props }">
                <v-list-item v-bind="props" title="">
                  <span class="text-primary">{{ item.raw.display }}</span>
                </v-list-item>
              </template>
              <template #selection="{ item }">
                <span class="text-primary">{{ item.raw.display }}</span>
              </template>
            </v-select>
            <v-hover
              v-if="overrideLanguage"
              v-slot="{ isHovering }"
            >
              <v-alert
                v-ripple
                density="compact"
                prominent
                :variant="isHovering ? 'flat' : 'tonal'"
                color="orange-accent-3"
                elevation="10"
                class="mt-3 mb-1"
                :icon="mdiGestureTap"
                style="cursor:pointer;"
                @click="overrideLanguage = undefined"
              >
                Language is being overridden to <code>{{ langs.find(x => x.val === overrideLanguage).display }}</code>, click here to reset.
              </v-alert>
            </v-hover>
            <v-switch
              v-model="useEnName"
              class="v-input--reverse v-input--expand mt-2"
              color="primary"
              inset
              prepend-icon=" "
              :label="$t('views.settings.useEnglishNameLabel')"
              :messages="$t('views.settings.useEnglishNameMsg')"
            />
          </v-card-text>
        </v-sheet>
      </v-col>
      <v-col :cols="slim ? 12 : currentCol">
        <v-sheet class="settings-group" :class="{'my-0 py-0': slim}">
          <v-card-title class="py-1">
            <v-icon
              size="large"
              disabled
              start
              class="ml-n3"
            >
              {{ icons.mdiCog }}
            </v-icon>
            <span class="text-h6 font-weight-light">{{ $t("views.settings.siteNavigationSettings") }}</span>
          </v-card-title>
          <v-card-text>
            <v-switch
              v-model="darkMode"
              class="v-input--reverse v-input--expand"
              color="primary"
              :label="$t('views.settings.darkModeLabel')"
              hide-details
              inset
              :prepend-icon="mdiWeatherNight"
            />
            <!-- :messages="$t('views.settings.darkModeMsg')" -->
            <div class="mt-6">
              <v-icon style="margin-right: 9px">
                {{ mdiPalette }}
              </v-icon>
              <span class="text-body-1">{{ $t("views.settings.theme") }}</span>
              <!-- <div class="theme-preview d-inline float-right text-body-1">
                                <span :style="`background:${themeSet[themeId].themes[mode].primary}`"></span>
                                <span :style="`background:${themeSet[themeId].themes[mode].secondary}`"></span>
                                {{ themeSet[themeId].name }}
                            </div> -->

              <v-select
                v-model="themeId"
                class="mt-0 d-inline-block float-right"
                hide-details
                density="compact"
                style="width: 150px"
                :items="themeSet"
                item-title="name"
                item-value="id"
              >
                <template #item="{ item, props }">
                  <v-list-item v-bind="props" title="">
                    <div class="theme-preview">
                      <span :style="`background:${item.raw.themes[mode].primary}`" />
                      <span :style="`background:${item.raw.themes[mode].secondary}`" />
                      {{ item.raw.name }}
                    </div>
                  </v-list-item>
                </template>
                <template #selection="{ item }">
                  <div class="theme-preview">
                    <span :style="`background:${item.raw.themes[mode].primary}`" />
                    <span :style="`background:${item.raw.themes[mode].secondary}`" />
                    {{ item.raw.name }}
                  </div>
                </template>
              </v-select>
            </div>

            <div class="mb-0 mt-6">
              <v-icon style="margin-right: 9px">
                {{ icons.mdiViewGrid }}
              </v-icon>
              <span class="text-body-1">{{ $t("views.settings.gridSizeLabel") }}</span>
            </div>
            <v-select
              v-model="currentGridSize"
              prepend-icon=" "
              class="mt-n4"
              item-title="text"
              :items="[
                { text: $t('views.settings.gridSize[0]'), value: 0 },
                { text: $t('views.settings.gridSize[1]'), value: 1 },
                { text: $t('views.settings.gridSize[2]'), value: 2 },
              ]"
              :messages="$t('views.settings.gridSizeMsg')"
            />
          </v-card-text>
        </v-sheet>
        <v-sheet v-if="!slim" class="settings-group mt-2">
          <v-card-text>
            <div>
              <v-icon style="margin-right: 9px">
                {{ mdiHome }}
              </v-icon>
              <span class="text-body-1">{{ $t("views.settings.defaultPage") }}</span>
            </div>
            <v-select
              v-model="defaultOpen"
              class="mt-n4"
              prepend-icon=" "
              item-title="text"
              :items="defaultOpenChoices"
              :messages="$t('views.settings.defaultPageMsg')"
            />

            <v-switch
              v-model="scrollMode"
              class="v-input--reverse v-input--expand mt-6"
              color="primary"
              :prepend-icon="scrollMode? mdiArrowExpandVertical:mdiBookOpenPageVariantOutline"
              inset
              :label="$t('views.settings.scrollModeLabel')"
              :messages="$t('views.settings.scrollModeMsg')"
            />
          </v-card-text>
        </v-sheet>
      </v-col>
      <v-col v-if="!slim" :cols="slim ? 12 : currentCol">
        <v-sheet class="settings-group">
          <v-card-title class="py-1">
            <v-icon
              size="large"
              disabled
              start
              class="ml-n3"
            >
              {{ mdiFilterOutline }}
            </v-icon>
            <span class="text-h6 font-weight-light">{{ $t("views.settings.videoFeedSettings") }}</span>
          </v-card-title>
          <v-card-text>
            <video-list-filters />
          </v-card-text>
        </v-sheet>

        <!-- YouTube quota usage -->
        <v-sheet class="settings-group mt-2">
          <v-card-title class="py-1">
            <span class="text-h6 font-weight-light">YouTube API</span>
          </v-card-title>
          <v-card-text v-if="quota">
            <div class="d-flex justify-space-between mb-1">
              <span>{{ quotaPercent }}%</span>
              <span class="text-medium-emphasis">{{ quota.used.toLocaleString() }} / {{ quota.limit.toLocaleString() }}</span>
            </div>
            <v-progress-linear
              :model-value="quotaPercent"
              :color="quota.exceeded ? 'error' : 'primary'"
              height="8"
              rounded
            />
            <div v-if="quota.exceeded" class="text-error text-caption mt-2">
              {{ $t("views.settings.quotaPaused") }}
            </div>
            <div class="text-medium-emphasis text-caption mt-1">
              {{ $t("views.settings.quotaDate", [quota.date]) }}
            </div>
          </v-card-text>
          <v-card-text v-else class="text-medium-emphasis">
            {{ $t("views.settings.quotaUnavailable") }}
          </v-card-text>
        </v-sheet>

        <!-- Data management (export / import / reset) -->
        <v-sheet class="settings-group mt-2">
          <v-card-title class="py-1">
            <span class="text-h6 font-weight-light">{{ $t("views.settings.dataManagement") }}</span>
          </v-card-title>
          <v-card-text class="mt-2" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <v-btn color="primary" @click="exportData">
              <v-icon start>
                {{ icons.mdiDownload }}
              </v-icon>
              {{ $t("views.settings.exportData") }}
            </v-btn>
            <v-btn color="primary" @click="triggerImport">
              <v-icon start>
                {{ icons.mdiUpload }}
              </v-icon>
              {{ $t("views.settings.importData") }}
            </v-btn>
            <input
              ref="importInput"
              type="file"
              accept="application/json"
              style="display: none"
              @change="importData"
            >
            <v-btn color="red" variant="outlined" @click="resetSettings">
              {{ $t("views.settings.resetAllSettings") }}
            </v-btn>
          </v-card-text>
        </v-sheet>

        <!-- About this site: the operator's service name (optional) and the MultiView attribution (fixed) -->
        <v-sheet v-if="!slim" class="settings-group mt-2">
          <v-card-title class="py-1">
            <v-icon size="large" disabled start class="ml-n3">
              {{ icons.mdiInformationOutline }}
            </v-icon>
            <span class="text-h6 font-weight-light">{{ $t("views.settings.about") }}</span>
          </v-card-title>
          <v-card-text class="pb-3">
            <div v-if="siteName" class="mb-1 text-body-1">{{ siteName }}</div>
            <!-- Optional links set by the operator in config.yaml -->
            <div v-if="siteLinks.length" class="d-flex align-center flex-wrap mb-3" style="gap: 12px">
              <a
                v-for="link in siteLinks"
                :key="link.url"
                :href="link.url"
                :title="link.label"
                target="_blank"
                rel="noopener noreferrer"
                class="d-inline-flex align-center text-medium-emphasis text-decoration-none"
              >
                <v-icon size="small" start>{{ resolveIcon(link.icon) }}</v-icon>
                <span class="text-caption">{{ link.label }}</span>
              </a>
            </div>
            <!-- MultiView attribution (fixed; a link to the system this site is built on) -->
            <a
              :href="multiviewRepoUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="d-inline-flex align-center text-medium-emphasis text-decoration-none"
            >
              <v-icon size="small" start>{{ icons.mdiGithub }}</v-icon>
              <span class="text-caption">Powered by MultiView</span>
            </a>
          </v-card-text>
        </v-sheet>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { langs } from "@/plugins/vuetify";
import {
    mdiFilterOutline,
    mdiEarth,
    mdiPalette,
    mdiCogBox,
    mdiWeatherNight,
    mdiHome,
    mdiEyeOff,
    mdiBookOpenPageVariantOutline,
    mdiArrowExpandVertical,
    mdiGestureTap,
    mdiLinkVariant,
} from "@mdi/js";
import * as curatedIcons from "@/utils/icons";
import themeSet from "@/utils/themes";
import { syncState } from "@/utils/functions";
import api from "@/utils/backend-api";
import { siteTitle } from "@/utils/site";
import { useRootStore } from "@/store/root.store";
import { useSettingsStore } from "@/store/settings.store";
import { useHomeStore } from "@/store/home.store";
import { useFavoritesStore } from "@/store/favorites.store";
import { useMultiviewStore } from "@/store/multiview.store";
import { useVolumeStore } from "@/store/volume.store";
import VideoListFilters from "@/components/setting/VideoListFilters.vue";

export default {
    // eslint-disable-next-line vue/multi-word-component-names
    name: "Settings",
    components: {
        VideoListFilters,
    },
    head() {
        const vm = this;
        return {
            get title() {
                return siteTitle(vm.$t("component.mainNav.settings"));
            },
        };
    },
    props: {
        slim: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            langs,
            mdiFilterOutline,
            mdiEarth,
            mdiPalette,
            mdiEyeOff,
            mdiCogBox,
            mdiWeatherNight,
            mdiHome,
            mdiBookOpenPageVariantOutline,
            mdiArrowExpandVertical,
            mdiGestureTap,

            quota: null,
            // Repository of MultiView itself (the system this site is built on); the fixed attribution link.
            multiviewRepoUrl: "https://github.com/Acc-Off/MultiView",
            themeId: +localStorage.getItem("theme") || 0,
            themeSet,
            defaultOpenChoices: Object.freeze([
                {
                    text: this.$t("component.mainNav.home"),
                    value: "home",
                },
                {
                    text: this.$t("component.mainNav.favorites"),
                    value: "favorites",
                },
                {
                    text: this.$t("component.mainNav.multiview"),
                    value: "multiview",
                },
            ]),
        };
    },
    computed: {
        ...syncState("settings", [
            "darkMode",
            "scrollMode",
            "defaultOpen",
        ]),
        rootStore() {
            return useRootStore();
        },
        settingsStore() {
            return useSettingsStore();
        },
        siteName() {
            return this.settingsStore.siteName;
        },
        siteLinks() {
            return this.settingsStore.siteLinks || [];
        },
        quotaPercent() {
            if (!this.quota || !this.quota.limit) return 0;
            return Math.round((this.quota.used / this.quota.limit) * 100);
        },
        currentCol() {
            if (this.$vuetify.display.smAndDown) return 12;
            if (this.$vuetify.display.md) return 6;
            if (this.$vuetify.display.lgAndUp) return 4;
            return null;
        },
        currentGridSize: {
            get() {
                return this.rootStore.currentGridSize;
            },
            set(val) {
                this.rootStore.setCurrentGridSize(val);
            },
        },
        useEnName: {
            get() {
                return this.settingsStore.useEnName;
            },
            set(val) {
                this.settingsStore.setUseEnName(val);
            },
        },
        language: {
            get() {
                return this.settingsStore.lang;
            },
            set(val) {
                this.settingsStore.setLanguage(val);
                if (this.overrideLanguage) {
                    // if a overriding language is present, force a reload to remove the override.
                    this.overrideLanguage = undefined;
                }
            },
        },
        overrideLanguage: {
            get() {
                return this.$route.query.lang;
            },
            set(v) {
                this.$route.query.lang = v;
                const r = this.$router.resolve({
                    name: this.$route.name, // put your route information in
                    params: this.$route.params, // put your route information in
                    query: this.$route.query, // put your route information in
                    hash: this.$route.hash,
                });
                window.location.assign(r.href);
            },
        },
        theme() {
            return this.$vuetify.theme;
        },
        mode() {
            return this.darkMode ? "dark" : "light";
        },
    },
    watch: {
        themeId(nw) {
            localStorage.setItem("theme", `${nw}`);
            // In Vuetify 3, theme.themes[name].colors is reactive (a Proxy). No Vue.set is needed:
            // replacing background/primary/secondary directly on colors takes effect immediately.
            const dark = this.$vuetify.theme.themes.dark.colors;
            const light = this.$vuetify.theme.themes.light.colors;
            Object.assign(dark, themeSet[nw].themes.dark);
            Object.assign(light, themeSet[nw].themes.light);
        },
    },
    mounted() {
        api.quota()
            .then((q) => { this.quota = q; })
            .catch((e) => console.error("failed to load quota", e));
    },
    methods: {
        // Resolve site_links[].icon from config.yaml against the icons in utils/icons.js (unknown names fall back to a generic link icon).
        resolveIcon(name) {
            return (name && curatedIcons[name]) || mdiLinkVariant;
        },
        goToSettings() {
            this.$emit("close");
            this.$router.push({ path: "/settings" });
        },
        resetSettings() {
            // eslint-disable-next-line no-restricted-globals,no-alert
            if (confirm(this.$t("views.settings.resetAllSettingsWarning"))) {
                useRootStore().resetState();
                useHomeStore().resetState();
                useSettingsStore().resetState();
                useFavoritesStore().resetState();
                useMultiviewStore().resetState();
                useVolumeStore().resetState();
                window.location.reload();
            }
        },
        // ---------- Export / Import ----------
        exportData() {
            const payload = {
                version: 1,
                exported_at: new Date().toISOString(),
                favorites: useFavoritesStore().favorites,
                settings: useSettingsStore().$state,
                multiview: useMultiviewStore().$state,
                // Channel volumes (a single dictionary shared by MultiView and the channel list page)
                volume: useVolumeStore().volumes,
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `multiview-backup-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        },
        triggerImport() {
            this.$refs.importInput.value = "";
            this.$refs.importInput.click();
        },
        importData(e) {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = () => {
                try {
                    const data = JSON.parse(String(reader.result));
                    if (Array.isArray(data.favorites)) {
                        useFavoritesStore().setFavorites(data.favorites);
                    }
                    if (data.volume && typeof data.volume === "object") {
                        useVolumeStore().setVolumes(data.volume);
                    }
                    // Default volumes from old backups. Now that the two are unified, fold them into volumes (volume takes precedence).
                    if (data.volumeDefaults && typeof data.volumeDefaults === "object") {
                        useVolumeStore().mergeVolumes(data.volumeDefaults);
                    }
                    if (data.multiview && Array.isArray(data.multiview.presetLayout)) {
                        // Add only preset layouts that do not duplicate existing ones
                        const mvStore = useMultiviewStore();
                        const existing = new Set(
                            (mvStore.presetLayout || []).map((p) => p.name),
                        );
                        data.multiview.presetLayout.forEach((preset) => {
                            if (preset && preset.name && !existing.has(preset.name)) {
                                mvStore.addPresetLayout(preset);
                            }
                        });
                    }
                    // Apply settings key by key (unknown keys are ignored)
                    if (data.settings && typeof data.settings === "object") {
                        if (typeof data.settings.darkMode === "boolean") useSettingsStore().setDarkMode(data.settings.darkMode);
                        if (data.settings.lang) useSettingsStore().setLanguage(data.settings.lang);
                    }
                    // eslint-disable-next-line no-alert
                    alert(this.$t("views.settings.importDone"));
                    window.location.reload();
                } catch (err) {
                    console.error(err);
                    // eslint-disable-next-line no-alert
                    alert(this.$t("views.settings.importFailed"));
                }
            };
            reader.readAsText(file);
        },
    },
};
</script>

<style lang="scss">
.settings-group {
    padding: 12px;
    border: 1px solid rgb(var(--v-theme-primary));
    border-radius: 8px;
}
.theme-preview span {
    width: 1rem;
    height: 0.5rem;
    margin-bottom: 0.5rem;
    display: inline-block;
    border-radius: 3px 3px 0 0;
    margin-left: 2px;
    &:nth-child(2) {
        margin-left: -1rem;
        height: 0.5rem;
        margin-bottom: 0rem;
        border-radius: 0 0 3px 3px;
    }
}

/* Upstream Holodex (Vuetify 2) set `.v-input__slot` to row-reverse to put the label on the
   left and the switch on the right. Vuetify 3 changed the structure (`.v-selection-control`),
   so the Vuetify 2 selectors no longer match and the label ends up misplaced.
   Reproduce the same layout (label left, toggle right, full-width label) with the
   Vuetify 3 class names. */
.v-input--reverse .v-selection-control {
    flex-direction: row-reverse;
    justify-content: flex-end;
    /* Center the toggle and label vertically (Vuetify 3's selection-control tends to stretch
       by default, which makes the label grow vertically and its text look top-aligned;
       this prevents that). */
    align-items: center;
}
.v-input--reverse .v-selection-control .v-selection-control__wrapper {
    margin-right: 0;
    margin-left: 8px;
}

// Bonus "expand" variant
.v-input--expand .v-selection-control {
    .v-label {
        /* Take the full width (flex:1) without stretching the label box vertically.
           With display:block, Vuetify 3 stretched it to the selection-control height (56px)
           and the text looked top-aligned (in upstream Holodex on Vuetify 2 it is a single
           20px line, the same height as the toggle).
           inline-flex with align-items:center centers the content vertically and restores
           the upstream look. */
        display: inline-flex;
        align-items: center;
        flex: 1;
    }
}

/* The switch colors (on = primary thumb / off = grey / track 0.32) are a Vuetify 3 default
   difference that affects every page, so they are handled once in App.vue's global CSS
   and are not set here. */
</style>
