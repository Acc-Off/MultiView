import pinia from "@/store";
import { useSettingsStore } from "@/store/settings.store";

/** Default site name for MultiView. If the operator sets site_name in config.yaml, that takes precedence. */
export const DEFAULT_SITE_NAME = "MultiView";

/** Site name for display. "MultiView" if site_name is not set. */
export function siteName(): string {
    return useSettingsStore(pinia).siteName || DEFAULT_SITE_NAME;
}

/**
 * Builds the page title.
 * - with page: "<page> - <siteName>"
 * - without page: "<siteName>"
 */
export function siteTitle(page?: string): string {
    const name = siteName();
    return page ? `${page} - ${name}` : name;
}
