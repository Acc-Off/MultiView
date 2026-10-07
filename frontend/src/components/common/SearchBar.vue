<template>
  <v-text-field
    v-model="query"
    class="ma-auto search-bar"
    :class="{ 'search-bar-small': isMobile }"
    variant="solo"
    flat
    density="compact"
    clearable
    hide-details
    :autofocus="autofocus"
    :prepend-inner-icon="icons.mdiMagnify"
    :label="$t('component.search.searchLabel')"
    @keydown.enter="commitSearch"
    @click:prepend-inner="commitSearch"
  />
</template>

<script lang="ts">
import { useRootStore } from "@/store/root.store";

export default {
    name: "SearchBar",
    props: {
        dense: {
            type: Boolean,
            default: false,
        },
        autofocus: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            query: this.$route.query.q || "",
        };
    },
    computed: {
        isMobile() {
            return useRootStore().isMobile;
        },
    },
    watch: {
        "$route.query": {
            deep: true,
            handler({ q }) {
                this.query = q || "";
            },
        },
    },
    methods: {
        commitSearch() {
            this.$router
                .push({ path: "/search", query: { q: this.query || undefined } })
                .catch(() => {});
        },
    },
};
</script>

<style lang="scss">
.search-bar {
    // As in upstream Holodex, only the width is constrained (max-width:670px). Centering is handled by
    // MainNav's .search-center-wrap (absolute centering), so no flex rules are set here.
    width: 100%;
    max-width: 670px !important;

    &.search-bar-small {
        max-width: 90vw !important;
    }
}
</style>
