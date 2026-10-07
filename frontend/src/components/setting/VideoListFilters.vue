<template>
  <div>
    <slot />
    <v-switch
      v-if="placeholderFilter"
      v-model="hidePlaceholder"
      class="v-input--reverse v-input--expand"
      color="primary"
      inset
      :label="$t('views.settings.hidePlaceholderStreams')"
      :messages="$t('views.settings.hideVideoThumbnailsMsg')"
      hide-details
    />
    <v-switch
      v-if="missingFilter"
      v-model="hideMissing"
      class="v-input--reverse v-input--expand"
      color="primary"
      inset
      :label="$t('views.settings.hideMissingStreams')"
      :messages="$t('views.settings.hideVideoThumbnailsMsg')"
      hide-details
    />
  </div>
</template>

<script lang="ts">
import { syncState } from "@/utils/functions";

export default {
    name: "VideoListFilters",
    props: {
        placeholderFilter: {
            type: Boolean,
            required: false,
            default: true,
        },
        missingFilter: {
            type: Boolean,
            required: false,
            default: true,
        },
    },
    computed: {
        ...syncState("settings", [
            "hidePlaceholder",
            "hideMissing",
        ]),
    },
};
</script>

<style>
</style>
