<template>
  <v-container style="height: 100%">
    <v-row>
      <v-col cols="12" offset-xl="1" xl="10">
        <v-text-field
          v-model="queryText"
          :label="$t('component.mainNav.search')"
          :prepend-inner-icon="icons.mdiMagnify"
          clearable
          autofocus
          variant="outlined"
          density="compact"
        />
      </v-col>
    </v-row>
    <v-row>
      <v-col cols="12" offset-xl="1" xl="10">
        <h4 v-if="liveResults.length" class="pa-1">
          {{ $t("views.home.liveOrUpcomingHeading") }} ({{ liveResults.length }})
        </h4>
        <VideoCardList
          v-if="liveResults.length"
          :videos="liveResults"
          include-channel
          include-avatar
        />
        <h4 v-if="archiveResults.length" class="pa-1 mt-4">
          {{ $t("component.mainNav.archive") }} ({{ archiveResults.length }})
        </h4>
        <VideoCardList
          v-if="archiveResults.length"
          :videos="archiveResults"
          include-channel
          include-avatar
        />
        <div
          v-if="queryText && !liveResults.length && !archiveResults.length"
          class="text-center text-medium-emphasis pa-8"
        >
          {{ $t("views.search.noResults") }}
        </div>
      </v-col>
    </v-row>
  </v-container>
</template>

<script lang="ts">
import { mapState } from "@/store/helpers";
import { useHomeStore } from "@/store/home.store";
import VideoCardList from "@/components/video/VideoCardList.vue";
import { siteTitle } from "@/utils/site";

export default {
    name: "Search",
    components: {
        VideoCardList,
    },
    head() {
        return { title: siteTitle("Search") };
    },
    data() {
        return {
            queryText: this.$route.query.q || "",
        };
    },
    computed: {
        ...mapState("home", ["live", "archive"]),
        normalizedQuery() {
            return (this.queryText || "").trim().toLowerCase();
        },
        liveResults() {
            return this.filterList(this.live);
        },
        archiveResults() {
            return this.filterList(this.archive);
        },
    },
    watch: {
        queryText(v) {
            this.$router.replace({ query: { ...this.$route.query, q: v || undefined } }).catch(() => {});
        },
    },
    created() {
        // Fetch the data if it has not been loaded yet
        const home = useHomeStore();
        home.fetchLive({ force: false });
        home.fetchArchive({ force: false });
    },
    methods: {
        filterList(list) {
            if (!this.normalizedQuery) return [];
            return (list || []).filter((v) => {
                const title = (v.title || "").toLowerCase();
                const name = (v.channel?.name || "").toLowerCase();
                return title.includes(this.normalizedQuery) || name.includes(this.normalizedQuery);
            });
        },
    },
};
</script>

<style></style>
