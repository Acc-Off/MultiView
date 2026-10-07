import {
    mapState as piniaMapState,
    mapActions as piniaMapActions,
} from "pinia";
import { useRootStore } from "./root.store";
import { useSettingsStore } from "./settings.store";
import { useHomeStore } from "./home.store";
import { useFavoritesStore } from "./favorites.store";
import { useMultiviewStore } from "./multiview.store";
import { useVolumeStore } from "./volume.store";

// Registry mapping the old Vuex namespace strings ("settings" etc.) to Pinia store hooks.
// Items without a namespace (root) go to useRootStore.
const STORE_HOOKS = {
    root: useRootStore,
    settings: useSettingsStore,
    home: useHomeStore,
    favorites: useFavoritesStore,
    multiview: useMultiviewStore,
    volume: useVolumeStore,
};

export function storeHookFor(namespace) {
    const hook = STORE_HOOKS[namespace || "root"];
    if (!hook) throw new Error(`Unknown store namespace: ${namespace}`);
    return hook;
}

// Wraps Pinia's mapState in a Vuex-compatible signature (namespace string + array/map of keys).
// When namespace is omitted (an array is passed as the first argument), the root store is used.
export function mapState(namespace, keys) {
    if (Array.isArray(namespace) || typeof namespace === "object") {
        return piniaMapState(useRootStore, namespace);
    }
    return piniaMapState(storeHookFor(namespace), keys);
}

// Equivalent of Vuex's mapGetters. In Pinia, getters are mapped with the same mapState as state.
export function mapGetters(namespace, keys) {
    if (Array.isArray(namespace) || typeof namespace === "object") {
        return piniaMapState(useRootStore, namespace);
    }
    return piniaMapState(storeHookFor(namespace), keys);
}

// Equivalent of Vuex's mapActions / mapMutations (Pinia merges both into actions).
export function mapActions(namespace, keys) {
    if (Array.isArray(namespace) || typeof namespace === "object") {
        return piniaMapActions(useRootStore, namespace);
    }
    return piniaMapActions(storeHookFor(namespace), keys);
}

export const mapMutations = mapActions;
