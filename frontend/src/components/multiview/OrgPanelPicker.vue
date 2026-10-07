<template>
  <!-- Toolbar (horizontal): compact dropdown -->
  <v-menu v-if="horizontal" location="bottom">
    <template #activator="{ props }">
      <v-btn v-bind="props" variant="flat">
        <template v-if="currentTab.name === 'YouTubeURL'">
          <v-icon>{{ icons.mdiYoutube }}</v-icon> URL
        </template>
        <template v-else-if="currentTab.name === 'TwitchURL'">
          <v-icon>{{ mdiTwitch }}</v-icon> URL
        </template>
        <template v-else>
          {{ currentTab.text || currentTab.name }}
        </template>
        <v-icon end size="small">
          {{ icons.mdiMenuDown }}
        </v-icon>
      </v-btn>
    </template>
    <v-list density="compact">
      <v-list-item v-for="panel in panels" :key="panel.name" :active="currentTab.name === panel.name" @click="select(panel)">
        <v-list-item-title>
          <v-icon>{{ panel.icon }}</v-icon> {{ panel.text }}
        </v-list-item-title>
      </v-list-item>
    </v-list>
  </v-menu>
  <!-- Modal (vertical): vertical tab list in the left column -->
  <v-list v-else density="compact" nav class="pa-0" :selected="[currentTab.name]" color="primary">
    <v-list-item v-for="panel in panels" :key="panel.name" :value="panel.name" @click="select(panel)">
      <template #prepend>
        <v-icon class="mr-2">{{ panel.icon }}</v-icon>
      </template>
      <v-list-item-title>{{ panel.text }}</v-list-item-title>
    </v-list-item>
  </v-list>
</template>

<script>
import { mdiTwitch, mdiBroadcast, mdiHeart, mdiYoutube } from "@mdi/js";

/* Video source picker for MultiView: All / Favorites / YouTube URL / Twitch URL */
export default {
    name: "OrgPanelPicker",
    props: {
        horizontal: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        const panels = [
            { name: "Live", text: this.$t("views.multiview.video.all"), icon: mdiBroadcast },
            { name: "Favorites", text: this.$t("component.mainNav.favorites"), icon: mdiHeart },
            { name: "YouTubeURL", text: "YouTube URL", icon: mdiYoutube, inputType: true },
            { name: "TwitchURL", text: "Twitch URL", icon: mdiTwitch, inputType: true },
        ];
        const currentTab = panels[0];
        this.$emit("changed", currentTab);
        return {
            panels,
            currentTab,
            mdiTwitch,
        };
    },
    methods: {
        select(val) {
            this.currentTab = val;
            this.$emit("changed", val);
        },
    },
};
</script>
