import type * as icons from "@/utils/icons";

// main.ts injects app.config.globalProperties.icons = icons (import * as icons).
// vue-tsc has no type information for this injection and wrongly reports this.icons as missing,
// so ComponentCustomProperties is extended via module augmentation to make it type-check.
declare module "vue" {
    interface ComponentCustomProperties {
        icons: typeof icons;
    }
}

export {};
