/* eslint-disable func-names */
import { createPinia } from "pinia";

const pinia = createPinia();

// Register pinia-plugin-persistedstate with a static import (not a dynamic one), and
// without importing any store module from this file.
// IMPORTANT: this file used to import every store via helpers, which created the circular
// import main.ts → store/index → settings.store → functions → helpers → store/index.
// As a result the settings store, the first one to be instantiated, was created
// before pinia.use() ran, so the persist plugin was never applied and persistence broke.
// Not importing stores here breaks the cycle and guarantees that pinia.use() runs first.
// eslint-disable-next-line import/no-extraneous-dependencies, global-require
import piniaPluginPersistedstate from "pinia-plugin-persistedstate";

pinia.use(piniaPluginPersistedstate);

// --- Live sync across tabs/windows (the multiview store is excluded) ---
// Listen for localStorage changes made by other windows via the storage event and apply
// them to the matching store with $patch. The multiview store (multiview-mv-v1) is
// deliberately left out.
//
// Why only the multiview store is excluded (the key to avoiding an infinite loop):
// It used to be synced too. The playback position (currentTime) rewrote layoutContent
// every 500 ms → storage → $patch → re-render → write-back → storage …, an infinite loop
// that made playing cells flicker across windows: they kept toggling between play and
// pause, and muted flipped every 0.5 s. currentTime has since been made local to VideoCell
// and removed from the store, but the multiview store holds the layout, which each window
// should be able to keep different (last write wins is fine), so it should not be
// live-synced in the first place (upstream Holodex has no such sync either; each window
// is independent).
// Sync is limited to the four stores that structurally have no high-frequency or
// automatic writers such as timers.
//
// Why this cannot loop:
//  1) Per the browser spec, the storage event (a) does not fire in the window that made
//     the change and (b) fires only when the value actually changes. The value applied by
//     $patch is identical to the sender's, so even when persist writes it back the
//     localStorage value is unchanged → no echo storage event fires.
//  2) On top of that, a re-entrancy guard (applyingRemote) ignores any event caused by a
//     persist write-back that runs while a storage-triggered $patch is in progress
//     (a second line of defense behind 1).
//  3) The four synced stores have no high-frequency or automatic writers (they are written
//     only on user actions), so an incoming $patch does not trigger further chained writes.
// Note: store hooks are imported dynamically inside the handler (not at top level) to
// avoid the circular import.
const SYNCED_STORE_LOADERS: Record<string, () => Promise<Record<string, any>>> = {
    "multiview-root-v1": () => import("./root.store"),
    "multiview-settings-v1": () => import("./settings.store"),
    "multiview-favorites-v1": () => import("./favorites.store"),
    "multiview-volume-v1": () => import("./volume.store"),
    // "multiview-mv-v1": deliberately omitted (see the comment above).
};

const SYNCED_STORE_HOOK_NAME: Record<string, string> = {
    "multiview-root-v1": "useRootStore",
    "multiview-settings-v1": "useSettingsStore",
    "multiview-favorites-v1": "useFavoritesStore",
    "multiview-volume-v1": "useVolumeStore",
};

if (typeof window !== "undefined") {
    // True while a storage-triggered $patch is running. Re-entrancy guard that ignores echo events.
    let applyingRemote = false;
    window.addEventListener("storage", async (event) => {
        if (applyingRemote) return;
        if (!event.key || event.newValue == null) return;
        const loader = SYNCED_STORE_LOADERS[event.key];
        if (!loader) return;
        try {
            const mod = await loader();
            const useStore = mod[SYNCED_STORE_HOOK_NAME[event.key]] as (p: typeof pinia) => any;
            applyingRemote = true;
            // Apply the latest localStorage value to the matching store.
            useStore(pinia).$patch(JSON.parse(event.newValue));
        } catch (e) {
            console.warn("cross-tab sync parse failed", event.key, e);
        } finally {
            applyingRemote = false;
        }
    });
}

export default pinia;
