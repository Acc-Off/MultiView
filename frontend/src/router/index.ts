import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import { loadLanguageAsync } from "@/plugins/vuetify";
import HomeFave from "../views/HomeFave.vue";
import pinia from "../store";
import { useRootStore } from "../store/root.store";
import { useSettingsStore } from "../store/settings.store";

// Vue 3 + vue-router 4 resolve the namespace of a dynamic import correctly (the Vue 2.7 Vue.extend freeze issue does not apply).
const Search = () => import("../views/Search.vue");
const Settings = () => import("../views/Settings.vue");
const NotFound = () => import("../views/NotFound.vue");
const MultiView = () => import("../views/MultiView.vue");
const ChannelList = () => import("../views/ChannelList.vue");

const routes: RouteRecordRaw[] = [
    {
        path: "/",
        name: "home",
        component: HomeFave,
        props: { isFavPage: false },
        beforeEnter(to, from, next) {
            // from.name === null when first load, check settings and redirect if necessary
            const { defaultOpen } = useSettingsStore(pinia);
            if (!from.name && defaultOpen !== "home" && to.fullPath === "/") {
                next(defaultOpen);
            } else {
                next();
            }
        },
    },
    {
        // Backwards compatibility with old home
        path: "/home",
        redirect(to) {
            const { hash, params, query } = to;
            return {
                name: "home", hash, params, query,
            };
        },
    },
    {
        path: "/favorites/",
        name: "favorites",
        component: HomeFave,
        props: { isFavPage: true },
    },
    {
        name: "multiview",
        path: "/multiview/:layout?",
        component: MultiView,
    },
    {
        name: "channels",
        path: "/channels",
        component: ChannelList,
    },
    {
        name: "search",
        path: "/search",
        component: Search,
    },
    {
        name: "settings",
        path: "/settings",
        component: Settings,
    },
    {
        path: "/404",
        component: NotFound,
    },
    {
        // vue-router 4: wildcards use the named-parameter syntax.
        path: "/:pathMatch(.*)*",
        component: NotFound,
    },
];

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes,
    // eslint-disable-next-line no-unused-vars
    scrollBehavior(to, from, savedPosition) {
        const rootStore = useRootStore(pinia);
        if (!rootStore.isMobile && !savedPosition) {
            rootStore.reloadCurrentPage({ source: "scrollBehavior", consumed: false });
        }
        if (to.path === from.path) {
            return savedPosition;
        }
        // vue-router 4 scroll positions are { left, top } (the old { x, y } was removed).
        return savedPosition || { left: 0, top: 0 };
    },
});

router.beforeEach((to, from, next) => {
    // In vue-router 4, to.query cannot be modified, so the lang query is read with a fallback to the value carried over from `from`.
    const queryLang = to.query.lang || from.query.lang;
    const { lang } = useSettingsStore(pinia);
    const actualLang = (queryLang as string) || lang;

    if (actualLang !== "en") {
        loadLanguageAsync(actualLang).then(() => next());
    } else {
        next();
    }
});

export default router;
