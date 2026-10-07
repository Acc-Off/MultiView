<template>
  <!-- Vuetify 3's v-autocomplete unconditionally clears search to '' on blur, so clicking the ✓ (append)
       icon (blur fires before click) wipes the typed value and submits nothing.
       In Vuetify 3, free input plus history suggestions is what v-combobox is for (it commits the typed
       value to the model and keeps it after blur). -->
  <v-combobox
    ref="vComboboxREF"
    v-model="url"
    :label="slim ? hint : label"
    :hint="hint"
    :error="error"
    :hide-details="slim"
    :variant="slim ? 'solo' : undefined"
    :append-icon="icons.mdiCheck"
    :color="(url && !error) ? 'green' : (error ? 'warning' : '')"
    clearable
    hide-no-data
    :items="history"
    class="px-3"
    :class="{ 'custom-url-slim': slim }"
    :menu-props="{ closeOnContentClick: true }"
    @keyup.enter="handleSubmit"
    @click:append="handleSubmit"
  />
</template>

<script>
import { getVideoIDFromUrl } from "@/utils/functions";
import { useMultiviewStore } from "@/store/multiview.store";

export default {
    name: "CustomUrlField",
    props: {
        twitch: {
            type: Boolean,
        },
        slim: {
            type: Boolean,
        },
    },
    data() {
        return {
            url: null,
            error: false,
        };
    },
    computed: {
        hint() {
            return this.twitch ? "https://www.twitch.tv/..." : "https://www.youtube.com/watch?v=...";
        },
        label() {
            return this.twitch ? "Twitch Channel Link" : "Youtube Video Link";
        },
        history() {
            const mv = useMultiviewStore();
            const hist = this.twitch ? mv.twUrlHistory : mv.ytUrlHistory;
            return [...hist].reverse();
        },
    },
    watch: {
        twitch() {
            this.url = null;
            this.error = false;
        },
    },
    methods: {
        handleSubmit() {
            const content = this.url ? getVideoIDFromUrl(this.url) : null;
            if (content && content.id) {
                this.error = false;
                this.$refs.vComboboxREF.isFocused = false; //  remove history selection bug cant close by itself
                this.$emit("onSuccess", content);
                if (!this.history.includes(this.url)) this.addHistory(this.url);
                this.url = null;
            } else {
                this.error = true;
            }
        },
        addHistory(url) {
            useMultiviewStore().addUrlHistory({ twitch: this.twitch, url });
        },
    },
};
</script>

<style>
/* The slim (top bar) variant shrinks to its content width inside the flex container, making the URL
   field extremely short (a regression: Vuetify 3 handles the default width of inputs differently from
   Vuetify 2). As in Vuetify 2, reserve a min-width wide enough to show the whole placeholder. */
.custom-url-slim {
    min-width: 320px;
}
</style>
