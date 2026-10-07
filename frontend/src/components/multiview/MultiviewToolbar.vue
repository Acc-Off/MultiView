<template>
  <v-toolbar class="mv-toolbar flex-grow-0" style="right: 0;" height="64">
    <v-app-bar-nav-icon @click="toggleMainNav" />
    <!-- Toolbar Live Video Selector -->
    <div
      class="justify-start d-flex mv-toolbar-btn align-center"
      style="flex: 1; min-width: 0;"
    >
      <slot name="left" />
    </div>
    <!-- Right side buttons -->
    <div
      class="justify-end d-flex mv-toolbar-btn align-center"
      :class="{ 'no-btn-text': isMobile || true }"
    >
      <!-- Show toolbar btns that are not collapsible or not in collapsed state -->
      <slot name="buttons" />
      <template
        v-for="(b, index) in buttons.filter((btn) => !btn.collapse)"
      >
        <!-- Create btn with tooltip -->
        <v-tooltip
          v-if="b.tooltip"
          :key="`mv-btn-${index}`"
          location="bottom"
          :color="b.color"
        >
          <template #activator="{ props }">
            <v-btn
              :color="b.color"
              icon
              v-bind="props"
              :class="{ 'mx-1': $vuetify.display.lgAndUp }"
              @click="b.onClick"
            >
              <v-icon>{{ b.icon }}</v-icon>
            </v-btn>
          </template>
          <span>{{ b.tooltip }}</span>
        </v-tooltip>
        <!-- Create normal button with no tooltip -->
        <v-btn
          v-else
          :key="`mv-btn-${index}`"
          :color="b.color"
          icon
          :class="{ 'mx-1': $vuetify.display.lgAndUp }"
          @click="b.onClick"
        >
          <v-icon>{{ b.icon }}</v-icon>
        </v-btn>
      </template>
      <!-- Share button and dialog -->
      <!-- Upstream Holodex (Vuetify 2) positioned this with bottom + nudge-bottom, which are not valid
           props in Vuetify 3. The activator sits at the right edge, so without a location the 80vw card
           runs off the right side of the screen and gets cut off. "bottom end" aligns it to the
           activator's right edge so the card opens leftward and stays on screen.
           Width: with only max-width:400, Vuetify 3 shrank the menu to its content width and it came
           out just 113px wide (Vuetify 2 measured a fixed 400px). Fix it with width="400". -->
      <v-menu
        v-model="shareDialog"
        :open-on-click="true"
        location="bottom end"
        offset="8"
        :close-on-content-click="false"
        :open-on-hover="false"
        width="400"
        max-width="400px"
        z-index="300"
      >
        <template #activator="{ props }">
          <v-btn v-bind="props" icon>
            <v-icon>{{ mdiLinkVariant }}</v-icon>
          </v-btn>
        </template>
        <!-- The menu is fixed at 400px, so the card at 100% also comes out at 400px (matching Vuetify 2). -->
        <v-card rounded="lg" width="100%">
          <v-card-text class="d-flex">
            <v-text-field
              readonly
              variant="solo-inverted"
              density="compact"
              hide-details
              :class="doneCopy ? 'copy-done' : ''"
              :model-value="exportURL"
              :append-inner-icon="mdiClipboardPlusOutline"
              @click:append-inner.stop="startCopyToClipboard(exportURL)"
            />
          </v-card-text>
        </v-card>
      </v-menu>
      <!-- Show vertical dots menu for collapsible buttons -->
      <v-menu location="bottom">
        <template #activator="{ props }">
          <v-btn
            v-show="collapseButtons.length"
            v-bind="props"
            icon
          >
            <v-icon>{{ icons.mdiDotsVertical }}</v-icon>
          </v-btn>
        </template>
        <v-list density="compact">
          <template v-for="(b, index) in collapseButtons" :key="`mv-collapsed-${index}`">
            <v-list-item
              block
              class="mb-2"
              @click="b.onClick"
            >
              <v-icon start :color="b.color">
                {{ b.icon }}
              </v-icon>
              <span>{{ b.tooltip }}</span>
            </v-list-item>
          </template>
        </v-list>
      </v-menu>
      <v-btn icon @click="collapseToolbar = true">
        <v-icon>{{ icons.mdiChevronUp }}</v-icon>
      </v-btn>
    </div>
  </v-toolbar>
</template>

<script>
import copyToClipboard from "@/mixins/copyToClipboard";
import { mdiLinkVariant, mdiClipboardPlusOutline } from "@mdi/js";
import { encodeLayout } from "@/utils/mv-utils";
import { mapState } from "@/store/helpers";
import { useRootStore } from "@/store/root.store";

export default {
    name: "MultiviewToolbar",
    mixins: [copyToClipboard],
    props: {
        buttons: {
            type: Array,
            default: () => [],
        },
        modelValue: Boolean,
    },
    emits: ["update:modelValue"],
    data() {
        return {
            mdiClipboardPlusOutline,
            mdiLinkVariant,
            shareDialog: false,
        };
    },
    computed: {
        ...mapState("multiview", ["layout", "layoutContent", "presetLayout"]),
        ...mapState("root", ["isMobile"]),
        exportURL() {
            if (!this.shareDialog) return "";
            const layoutParam = `/${encodeURIComponent(
                encodeLayout({
                    layout: this.layout,
                    contents: this.layoutContent,
                    includeVideo: true,
                }),
            )}`;
            return `${window.origin}/multiview${layoutParam}`;
        },
        collapseToolbar: {
            get() {
                return this.modelValue;
            },
            set(value) {
                this.$emit("update:modelValue", value);
            },
        },
        collapseButtons() {
            return this.buttons.filter((btn) => btn.collapse);
        },
    },
    methods: {
        startCopyToClipboard(txt) {
            this.copyToClipboard(txt);
            const thisCopy = this;
            setTimeout(() => {
                thisCopy.shareDialog = false;
            }, 200);
        },
        toggleMainNav() {
            const rootStore = useRootStore();
            rootStore.setNavDrawer(!rootStore.navDrawer);
        },
    },
};
</script>

<style lang="scss">
/* Upstream Holodex (Vuetify 2) used `<v-btn icon>` (default size, 24px icon) and squeezed only the
   button's outer box to 36px with CSS (the icon stayed at the default 24px).
   In Vuetify 3 the default icon button is 48px and the size class was renamed from `.v-size--default`
   to `.v-btn--size-default`, so the old CSS no longer matched and it stayed at 48px. Reapply 36px using
   the Vuetify 3 class name and keep the icon at the default 24px (the same approach as before: squeeze
   only the outer box). */
.mv-toolbar-btn .v-btn.v-btn--icon.v-btn--size-default {
    height: 36px;
    width: 36px;
}
.mv-toolbar-btn .v-btn.v-btn--icon.v-btn--size-default .v-icon {
    font-size: 24px;
}

/* Upstream Holodex's (Vuetify 2) `<v-toolbar>` (no color set) had v-sheet's default surface background
   (dark=#272727 / light=#fff). Vuetify 3's `<v-toolbar>` changed its default background to a
   non-surface grey (dark=#424242 / light=#eee), so the header background no longer matched.
   Set it back to the surface equivalent (dark=#272727 / light=#fff), as upstream. */
.mv-toolbar.v-toolbar {
    background-color: rgb(var(--v-theme-surface));
}
.v-theme--dark .mv-toolbar.v-toolbar {
    background-color: #272727;
}
.mv-toolbar {
    z-index: 1;
}

/* The Vuetify 2 global color class `green lighten-2` (#A5D6A7 in the standard Vuetify 2 palette) does
   not exist in Vuetify 3. Reproduce the copy-done highlight with our own CSS (green field background). */
.copy-done .v-field {
    background-color: #a5d6a7 !important;
}
</style>
