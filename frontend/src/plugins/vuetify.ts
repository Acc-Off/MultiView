import "vuetify/styles";
import { createVuetify } from "vuetify";
import { createI18n } from "vue-i18n";
import { useI18n } from "vue-i18n";
import { createVueI18nAdapter } from "vuetify/locale/adapters/vue-i18n";
import { en as vuetifyEn } from "vuetify/locale";
import { aliases, mdi } from "vuetify/iconsets/mdi-svg";
import themeSet, { lighten, darken } from "@/utils/themes";

import enTL from "@/locales/en/ui.yml";
import { dayjs } from "@/utils/time";

// ====== i18n setup ======
export const langs = [
    { val: "en", display: "English" },
    { val: "ja", display: "日本語" },
];

export const asyncLang = {
    async ja() {
        await import("dayjs/locale/ja");
        return import("@/locales/ja-JP/ui.yml");
    },
};

// legacy:true keeps the Options API $t that the components use.
export const i18n = createI18n({
    legacy: true,
    allowComposition: true,
    locale: "en",
    fallbackLocale: "en",
    messages: {
        en: { $vuetify: vuetifyEn, ...enTL },
    },
    pluralizationRules: {
        ru(choice, choicesLength) {
            if (choice === 0) return 0;
            const teen = choice > 10 && choice < 20;
            const endsWithOne = choice % 10 === 1;
            if (choicesLength < 4) return !teen && endsWithOne ? 1 : 2;
            if (!teen && endsWithOne) return 1;
            if (!teen && choice % 10 >= 2 && choice % 10 <= 4) return 2;
            return choicesLength < 4 ? 2 : 3;
        },
    },
});

const loadedLanguages = ["en"];
const dayjsName: Record<string, string> = {};

// Dynamically load the built-in Vuetify locale for a language code; fall back to en on failure.
async function loadVuetifyLocale(lang: string) {
    try {
        const mod: any = await import("vuetify/locale");
        return mod[lang] || vuetifyEn;
    } catch (e) {
        return vuetifyEn;
    }
}

function setI18nLanguage(lang: string) {
    // In legacy mode, i18n.global.locale is a string, not a ref.
    (i18n.global.locale as any).value
        ? ((i18n.global.locale as any).value = lang)
        : ((i18n.global as any).locale = lang);
    const dayjsLang = dayjsName[lang] || lang || "en";
    dayjs.locale(dayjsLang);
}

export function loadLanguageAsync(lang: string): Promise<void> {
    const current = (i18n.global.locale as any).value ?? (i18n.global as any).locale;
    if (current === lang) return Promise.resolve();

    if (loadedLanguages.includes(lang)) {
        setI18nLanguage(lang);
        return Promise.resolve();
    }

    return (asyncLang as any)[lang]().then(async (msg: any) => {
        // Also load Vuetify's own locale ($vuetify.*) to avoid warnings when switching to ja.
        const vuetifyLocale = await loadVuetifyLocale(lang);
        i18n.global.setLocaleMessage(lang, { $vuetify: vuetifyLocale, ...msg.default });
        loadedLanguages.push(lang);
        setI18nLanguage(lang);
    });
}
// ====== end i18n setup ======

const initThemeJSON = localStorage.getItem("theme");
const theme = themeSet[+(initThemeJSON || 0)] || themeSet[0];

// The initial darkMode is read from the persisted pinia settings blob (multiview-settings-v1),
// which is the single source of truth. This module is evaluated before pinia is created, so the
// value cannot be read from the store and the persisted JSON is read directly instead.
// The old standalone "darkMode" key is kept only as a backward-compatible fallback.
function readInitialDarkMode(): boolean {
    try {
        const raw = localStorage.getItem("multiview-settings-v1");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (typeof parsed?.darkMode === "boolean") return parsed.darkMode;
        }
    } catch {
        /* fall through to the fallback if the JSON is corrupt */
    }
    return localStorage.getItem("darkMode") !== "false"; // true if unset
}
const darkTheme = readInitialDarkMode();

// Vuetify 3 has no darken-N/lighten-N theme color variants, so the derived colors are
// registered explicitly as theme colors to reproduce `secondary darken-1` and the like,
// which upstream Holodex (Vue 2) used heavily.
// This makes classes such as `bg-secondary-darken-1` / `text-secondary-darken-1` available.
// Only the variants the old version actually used are generated
// (primary lighten-1 / secondary darken-1, darken-3, lighten-1).
function buildColors(t: { background: string; primary: string; secondary: string }) {
    return {
        background: t.background,
        // The upstream Holodex drawer/footer use `background lighten1`/`lighten2`
        // (a dark color slightly lighter than the background). Vuetify 3's surface is
        // too bright, so these derived colors reproduce the upstream look.
        "background-lighten-1": lighten(t.background, 1),
        "background-lighten-2": lighten(t.background, 2),
        primary: t.primary,
        "primary-lighten-1": lighten(t.primary, 1),
        secondary: t.secondary,
        "secondary-lighten-1": lighten(t.secondary, 1),
        "secondary-darken-1": darken(t.secondary, 1),
        "secondary-darken-3": darken(t.secondary, 3),
    };
}

// Vuetify 3 theme format: themes.<name>.colors.<key>. Both dark and light are registered and defaultTheme selects one.
export const vuetify = createVuetify({
    // Uses @mdi/js (SVG paths). Keep importing icons individually (never import the whole package).
    icons: {
        defaultSet: "mdi",
        aliases,
        sets: { mdi },
    },
    theme: {
        defaultTheme: darkTheme ? "dark" : "light",
        themes: {
            dark: {
                dark: true,
                colors: buildColors(theme.themes.dark),
            },
            light: {
                dark: false,
                colors: buildColors(theme.themes.light),
            },
        },
    },
    locale: {
        // i18n uses legacy:true (to keep the Options API $t). The adapter's types require
        // Composition mode (I18n<...,false>), but a legacy instance works at runtime, so only
        // the type is cast to any.
        adapter: createVueI18nAdapter({ i18n: i18n as any, useI18n }),
    },
});
