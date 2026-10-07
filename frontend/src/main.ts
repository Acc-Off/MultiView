import { createApp } from "vue";
import { VueHeadMixin } from "@unhead/vue";
import { createHead } from "@unhead/vue/client";
import * as icons from "@/utils/icons";
import App from "./App.vue";
import pinia from "./store";
import { useSettingsStore } from "./store/settings.store";
import router from "./router";
import { i18n, vuetify, loadLanguageAsync } from "./plugins/vuetify";

// Load the messages for the user's language before mounting.
// Having the locale settled by the first render prevents a flash of English before Japanese
// appears, as well as i18n fallback warnings.
// pinia-plugin-persistedstate hydrates the settings store synchronously on creation,
// so creating it here before mount gives access to the persisted lang.
async function bootstrap() {
    const app = createApp(App);
    // IMPORTANT: plugins registered with pinia.use(plugin) are only queued in toBeInstalled.
    // They move to _p on app.use(pinia) (install) and apply only to stores created after that.
    // So app.use(pinia) must always run before the first store (settings) is created.
    // Otherwise settings alone misses the persist plugin and is never persisted
    // (this was the root cause of an actual bug).
    app.use(pinia);

    // Preloading the locale reads the persisted lang, so settings is created after pinia is installed.
    const settings = useSettingsStore(pinia);
    try {
        await loadLanguageAsync(settings.lang);
    } catch (e) {
        // On failure, startup continues with the default en.
        console.error("failed to preload locale", e);
    }

    app.use(router);
    app.use(i18n);
    app.use(vuetify);
    app.use(createHead());
    // Components declare their page title with the head() option; this mixin feeds it to unhead,
    // so the title follows the route, the UI language and the operator's site_name.
    app.mixin(VueHeadMixin);
    // Provide icons globally (the equivalent of the former Vue.prototype.icons).
    app.config.globalProperties.icons = icons;
    app.mount("#app");
}

bootstrap();
