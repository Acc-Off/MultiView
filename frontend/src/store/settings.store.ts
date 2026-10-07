/* eslint-disable no-shadow */
import { defineStore } from "pinia";
import { getUILang, getLang } from "@/utils/functions";

const userLanguage = navigator.language || (navigator as any).userLanguage || "en";

const englishNamePrefs = new Set(["en", "es", "fr", "id", "pt", "de", "ru", "it"]);
const lang = getLang(userLanguage);

function initialState() {
    return {
        // Language
        lang: getUILang(userLanguage), // UI lang
        foolsLang: "",
        clipLangs: [lang],

        // Site
        darkMode: true,
        defaultOpen: "home",

        // Content
        redirectMode: false,
        autoplayVideo: false,
        scrollMode: true,
        hideThumbnail: false,
        hidePlaceholder: false,
        hideMissing: false,
        nameProperty: englishNamePrefs.has(lang) ? "english_name" : "name",
        hideCollabStreams: false,
        hiddenGroups: {},
        ignoredTopics: [],
        // Valid values: "grid" | "list" | "denseList"
        homeViewMode: "grid",

        // MultiView: public settings fetched from the server's /api/config/public (not persisted)
        publicRefreshEnabled: false,
        // Site name / links set by the operator in config.yaml ("" / [] if unset)
        siteName: "",
        siteLinks: [],

        // Live TL Window Settings
        liveTlStickBottom: false,
        liveTlLang: lang,
        liveTlFontSize: 14,
        liveTlShowVerified: true, // show verified messages
        liveTlShowModerator: true, // show moderator messages
        liveTlShowVtuber: true, // show vtuber messages
        liveTlShowLocalTime: false, // show client local time
        liveTlWindowSize: 0, // Default size, otherwise percentage height
        liveTlShowSubtitle: true, // Show subtitles on videos
        liveTlHideSpoiler: false, // Hide message past current video time
        liveTlBlocked: [],

        blockedChannels: [],

        // Deprecated
        canUseWebP: true,
        testedWebP: false,
    };
}

// Actions generated in bulk as simple setters of the form setX(val){ this.x = val }.
const simpleSetters = [
    "defaultOpen",
    "liveTlStickBottom",
    "liveTlLang",
    "liveTlFontSize",
    "liveTlShowVerified",
    "liveTlShowModerator",
    "liveTlShowLocalTime",
    "liveTlWindowSize",
    "hideCollabStreams",
    "ignoredTopics",
    "liveTlShowVtuber",
    "liveTlShowSubtitle",
    "liveTlHideSpoiler",
    "hidePlaceholder",
    "hideMissing",
    "homeViewMode",
];
function createSimpleSetters(keys) {
    return keys.reduce((acc, key) => {
        const name = `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;
        acc[name] = function setter(val) {
            this[key] = val;
        };
        return acc;
    }, {});
}

export const useSettingsStore = defineStore("settings", {
    state: initialState,
    getters: {
        useEnName: (state) => state.nameProperty === "english_name",
        blockedChannelIDs: (state) => new Set(state.blockedChannels.map((x) => x.id)),
        liveTlBlockedNames: (state) => new Set(state.liveTlBlocked),
        ignoredTopicsSet: (state) => new Set(state.ignoredTopics),
    },
    actions: {
        ...createSimpleSetters(simpleSetters),
        setDarkMode(val) {
            // Persistence is handled solely by Pinia's persist (multiview-settings-v1).
            // The duplicate write to the legacy standalone "darkMode" key was removed (vuetify.ts reads from the persisted blob).
            this.darkMode = val;
        },
        setRedirectMode(val) {
            this.redirectMode = val;
        },
        setAutoplayVideo(val) {
            this.autoplayVideo = val;
        },
        noWebPSupport() {
            this.canUseWebP = false;
        },
        testedWebPSupport() {
            this.testedWebP = true;
        },
        setUseEnName(payload) {
            this.nameProperty = payload ? "english_name" : "name";
        },
        setHideThumbnail(val) {
            this.hideThumbnail = val;
        },
        setLanguage(val) {
            this.lang = val;
        },
        setClipLangs(val) {
            this.clipLangs = val;
        },
        setIgnoredTopics(val) {
            this.ignoredTopics = val;
        },
        setScrollMode(val) {
            this.scrollMode = val;
        },
        setPublicConfig({ publicRefreshEnabled, siteName, siteLinks }) {
            this.publicRefreshEnabled = publicRefreshEnabled;
            this.siteName = siteName || "";
            this.siteLinks = siteLinks || [];
        },
        resetState() {
            Object.assign(this, initialState());
            localStorage.removeItem("theme");
            localStorage.removeItem("darkMode");
        },
        toggleBlocked(channel) {
            if (!this.blockedChannels) this.blockedChannels = [];
            if (this.blockedChannels.filter((x) => x.id === channel.id).length > 0) {
                this.blockedChannels.splice(
                    this.blockedChannels.findIndex((x) => x.id === channel.id),
                    1,
                );
            } else {
                this.blockedChannels.push(channel);
            }
        },
        toggleGroupDisplay(group) {
            const groupName = `${group.title}`.toLowerCase();
            const orgName = `${group.org}`;
            if (!this.hiddenGroups) this.hiddenGroups = {};
            if (!this.hiddenGroups[orgName]) this.hiddenGroups[orgName] = [];
            if (this.hiddenGroups[orgName].includes(groupName)) {
                this.hiddenGroups[orgName].splice(
                    this.hiddenGroups[orgName].findIndex((x) => x.toLowerCase() === groupName),
                    1,
                );
            } else {
                this.hiddenGroups[orgName].push(groupName);
            }
        },
        toggleLiveTlBlocked(name) {
            if (!this.liveTlBlocked) this.liveTlBlocked = [];
            const index = this.liveTlBlocked.indexOf(name);
            if (index !== -1) {
                this.liveTlBlocked.splice(index, 1);
            } else {
                this.liveTlBlocked.push(name);
            }
        },
    },
    persist: {
        key: "multiview-settings-v1",
        // Public settings are fetched from the server's /api/config/public every time, so they are not persisted
        // (if stored in localStorage, stale values could briefly be restored on reload).
        omit: ["publicRefreshEnabled", "siteName", "siteLinks"],
    },
});
