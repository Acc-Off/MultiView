/* eslint-disable no-shadow */
import { defineStore } from "pinia";
import type { LayoutItem } from "@/external/vue-grid-layout/src/helpers/utils";
import { bottom, getFirstCollision } from "@/external/vue-grid-layout/src/helpers/utils";
import {
 getDesktopDefaults, desktopPresets, mobilePresets, decodeLayout,
 generateContentId, isTwitchVideo, GRID_COLS, GRID_ROWS, SNAP_STEPS, DEFAULT_SNAP_INDEX,
} from "@/utils/mv-utils";
import type { Content } from "@/utils/mv-utils";
import debounce from "lodash-es/debounce";
import axios from "axios";
import { CHANNEL_URL_REGEX, CHANNEL_HANDLE_URL_REGEX } from "@/utils/consts";
import { checkIOS } from "@/utils/functions";

const isAppleDevice = navigator?.platform ? checkIOS() : false;

function initialState() {
    return {
        layout: [] as LayoutItem[],
        index: 1,
        layoutContent: {} as Record<string, Content>,
        presetLayout: [] as any[],
        // --- The fields below are persisted ---
        autoLayout: getDesktopDefaults(),
        ytUrlHistory: [] as string[],
        twUrlHistory: [] as string[],
        // Default true for iOS device
        muteOthers: isAppleDevice,
        syncOffsets: {} as Record<string, any>,
        // Snap granularity while editing. Index into SNAP_STEPS (0 = coarsest … last = finest).
        snapIndex: DEFAULT_SNAP_INDEX,
        // Stream title filter for stream selection (the top icon strip and the selection dialog).
        // Interpreted as a case-insensitive regular expression; falls back to substring matching
        // if the regex is invalid. Empty string = no filter.
        // This is per-window view state, so it lives in the multiview store (not cross-tab synced).
        titleFilter: "" as string,
    };
}

const missingVideoDataFilter = (x: any) => x.type === "video" && !isTwitchVideo(x.video) && x.video.id === x.video.channel?.name && !(x?.video?.noData);
// oembed is YouTube-only, so Twitch is excluded (sending a Twitch id returns 400).
const videoIsLiveFilter = (x: any) => !isTwitchVideo(x?.video)
    && (x?.video?.status === "live" || x?.video?.status === "upcoming");

// The debounced muteOthers implementation is kept outside the Pinia actions
// (so that there is exactly one debounce instance per action).
const debouncedMuteOthers = debounce((state: any, currentKey: any) => {
    if (!state.muteOthers) return;
    Object.keys(state.layoutContent).forEach((key) => {
        if (key === `${currentKey}`) {
            state.layoutContent[key].muted = false;
            return;
        }
        if (state.layoutContent[key]?.type === "video") {
            state.layoutContent[key].muted = true;
        }
    });
}, 0, { trailing: true });

export const useMultiviewStore = defineStore("multiview", {
    state: initialState,
    getters: {
        // Current snap granularity (rounding unit applied when a move/resize is committed). Guards against an out-of-range index.
        snapStep(state) {
            return SNAP_STEPS[state.snapIndex] ?? SNAP_STEPS[DEFAULT_SNAP_INDEX];
        },
        nonChatCellCount(state) {
            return state.layout.reduce((a: number, c: any) => a + ((!state.layoutContent[c.i] || state.layoutContent[c.i]?.type === "video") ? 1 : 0), 0);
        },
        activeVideos(state) {
            return state.layout
                .filter((item: any) => state.layoutContent[item.i] && state.layoutContent[item.i].type === "video")
                .map((item: any) => state.layoutContent[item.i].video);
        },
        decodedCustomPresets(state) {
            return state.presetLayout.map((preset: any) => ({
                ...preset,
                ...decodeLayout(preset.layout),
            }));
        },
        decodedDesktopPresets() {
            return desktopPresets.map((preset) => ({
                ...preset,
                ...decodeLayout(preset.layout),
            }));
        },
        decodedMobilePresets() {
            return mobilePresets.map((preset) => ({
                ...preset,
                ...decodeLayout(preset.layout),
            }));
        },
        desktopGroups(): any[] {
            const groups: any[] = [];
            const seen = new Set();
            const customId = new Set(this.decodedCustomPresets.map((p: any) => p.id));
            this.decodedCustomPresets.concat(this.decodedDesktopPresets).forEach((preset: any) => {
                if (seen.has(preset.id)) return;
                seen.add(preset.id);
                if (customId.has(preset.id)) preset.custom = true;
                if (!groups[preset.videoCellCount]) groups[preset.videoCellCount] = [];
                groups[preset.videoCellCount].push(preset);
            });
            return groups;
        },
    },
    actions: {
        async fetchVideoData(options: { refreshLive: boolean } | undefined) {
            // Load missing video data from backend
            const videoIds = new Set<string>(Object.values<Content>(this.layoutContent)
                .filter((x) => missingVideoDataFilter(x) || (options?.refreshLive && videoIsLiveFilter(x)))
                .map((x) => x.video.id));
            console.log("Refreshing video data", videoIds, Object.values(this.layoutContent));
            // Nothing to do
            if (!videoIds.size) return;
            // MultiView fills in the metadata of videos added by URL using YouTube oembed.
            // A single oembed failure must not take down the whole Promise.all; apply whatever succeeded.
            const results = await Promise.all([...videoIds].map((id) => {
                const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}`;
                return axios.get(url).catch((e) => {
                    console.warn(`oembed fetch failed for video ${id}`, e);
                    return null;
                });
            }));
            const dataFromYt = results
                .filter((res) => res && res.data)
                .map((res: any) => {
                    const { data, config } = res;
                    const channel = data.author_url.match(CHANNEL_URL_REGEX);
                    const channelId = channel && channel.length >= 2 && channel[1];
                    // YouTube's author_url now uses the /@handle form, so the UC channel id cannot be extracted.
                    // Capture the handle into channel.handle so that ChannelImg can use it as a fallback
                    // lookup key when it cannot resolve by id (UC). channel.id keeps its existing meaning (UC id or name).
                    const handleMatch = data.author_url.match(CHANNEL_HANDLE_URL_REGEX);
                    const handle = handleMatch?.groups?.handle || null;
                    const videoId = config.url.replace("https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=", "");
                    return {
                        id: videoId,
                        title: data.title,
                        channel: {
                            name: data.author_name,
                            id: channelId || data.author_name,
                            ...(handle && { handle }),
                        },
                    };
                });
            this.setVideoData(dataFromYt);
        },
        setLayout(layout: LayoutItem[]) {
            this.layout = layout;
        },
        setLayoutContentById(payload: { id: string; content: Content }) {
            const { id, content } = payload;
            this.layoutContent[id] = content;
        },
        setLayoutContent(content: Record<string, Content>) {
            this.layoutContent = content;
        },
        addLayoutItem() {
            // Increment the counter to ensure key is always unique.
            let newLayoutItem: LayoutItem;

            // The default cell is 1/3 × 1/3. GRID_COLS : GRID_ROWS is 2:1, so
            // w = GRID_COLS/3, h = GRID_ROWS/3 makes the rendered cell exactly 16:9.
            const w = GRID_COLS / 3;
            const h = GRID_ROWS / 3;
            // Step the search by the cell size (stepping by 1 would be needlessly expensive on a 120×60 grid).
            const stepX = w;
            const stepY = h;

            // try to find a good location for it:
            let foundGoodSpot = false;
            for (let y = 0; !foundGoodSpot && y + h <= GRID_ROWS; y += stepY) {
                for (let x = 0; !foundGoodSpot && x + w <= GRID_COLS; x += stepX) {
                    newLayoutItem = {
                        x,
                        y,
                        w,
                        h,
                        i: generateContentId(),
                        isResizable: true,
                        isDraggable: true,
                    };

                    const collision = getFirstCollision(this.layout, newLayoutItem);
                    if (!collision) {
                        foundGoodSpot = true;
                    }
                }
            }

            if (!newLayoutItem! || !foundGoodSpot) {
                // If there is no free spot, place it below the last content (outside the one-screen 60 rows).
                // The old y = GRID_ROWS - h created the cell on top of existing ones, and
                // combined with preventCollision it could then be neither moved nor resized.
                // The grid can grow vertically (maxRows is unbounded), so put it below instead of overlapping.
                newLayoutItem = {
                    x: 0,
                    y: bottom(this.layout),
                    w,
                    h,
                    i: generateContentId(),
                    isResizable: true,
                    isDraggable: true,
                };
            }
            this.layout.push(newLayoutItem!);
        },
        setLayoutContentWithKey({ id, key, value }: { id: string; key: string; value: any }) {
            if (this.layoutContent[id]) (this.layoutContent[id] as any)[key] = value;
        },
        removeLayoutItem(id: string) {
            const index = this.layout.map((item: any) => item.i).indexOf(id);
            this.layout.splice(index, 1);
            if (this.layoutContent[id]) delete this.layoutContent[id];
        },
        freezeLayoutItem(id: string) {
            const index = (this.layout as Array<any>).findIndex((x) => x.i === id);
            this.layout[index].isResizable = false;
            this.layout[index].isDraggable = false;
        },
        unfreezeLayoutItem(id: string) {
            const index = (this.layout as Array<any>).findIndex((x) => x.i === id);
            this.layout[index].isResizable = true;
            this.layout[index].isDraggable = true;
        },
        deleteLayoutContent(id: string) {
            delete this.layoutContent[id];
        },
        addPresetLayout(content: any) {
            this.presetLayout.push(content);
        },
        removePresetLayout(name: string) {
            const index = this.presetLayout.findIndex((x: any) => x.name === name);
            this.presetLayout.splice(index, 1);
        },
        resetState() {
            Object.assign(this, JSON.parse(JSON.stringify(initialState())), {
                presetLayout: this.presetLayout,
            });
        },
        setAutoLayout({ index, encodedLayout }: { index: number; encodedLayout: any }) {
            this.autoLayout[index] = encodedLayout;
        },
        resetAutoLayout() {
            this.autoLayout = getDesktopDefaults();
        },
        addUrlHistory({ twitch = false, url }: { twitch?: boolean; url: string }) {
            const history = (twitch ? this.twUrlHistory : this.ytUrlHistory);
            if (history.length >= 8) history.shift();
            history.push(url);
        },
        setSnapIndex(index: number) {
            // Clamp into range (prevents snapStep from becoming undefined on an invalid value).
            this.snapIndex = Math.max(0, Math.min(SNAP_STEPS.length - 1, index));
        },
        setMuteOthers(val: boolean) {
            this.muteOthers = val;
            // Setting is set to true, flip all but one to muted
            if (val) {
                Object.keys(this.layoutContent)
                .filter((key) => this.layoutContent[key]?.type === "video")
                .forEach((key, index) => {
                    this.layoutContent[key].muted = index !== 0;
                });
            }
        },
        // Note: state has a boolean flag that is also named `muteOthers`, so this action must use
        // a different name. Pinia merges state and actions into the same store instance, so with
        // the same name the action overwrites the state, `state.muteOthers` becomes a function, and
        // the guard `if (!state.muteOthers)` is always false → others get muted even when the flag is off.
        applyMuteOthers(currentKey: any) {
            debouncedMuteOthers(this, currentKey);
        },
        setVideoData(videos: any[]) {
            if (!videos) return;
            videos.forEach((video) => {
                Object.values<Content>(this.layoutContent).forEach((x) => {
                    if (x.video?.id === video.id) {
                        x.video = video;
                    }
                });
            });
            // Mark videos still missing data, so it doesn't attempt to fetch again
            Object.values<Content>(this.layoutContent).filter(missingVideoDataFilter).forEach((x) => { x.video.noData = true; });
        },
        setSyncOffsets({ id, value }: { id: string; value: any }) {
            this.syncOffsets[id] = value;
        },
        swapGridPosition({ id1, id2 }: { id1: number; id2: number }) {
            const { x: tX, y: tY, w: tW, h: tH } = this.layout[id1] as any;
            const { x, y, w, h } = this.layout[id2] as any;
            Object.assign(this.layout[id1], { ...this.layout[id1], x, y, w, h });
            Object.assign(this.layout[id2], { ...this.layout[id2], x: tX, y: tY, w: tW, h: tH });
            // Swapping only the coordinates leaves the array order unchanged, so a chat's currentTab
            // (= index into activeVideos) keeps following the video. For a reorder we want the chat to
            // follow the cell position instead, so when two video cells are swapped, also swap the
            // references of the chats pointing at those two videos.
            const videoIndexOf = (idx: number) => {
                const item = this.layout[idx] as any;
                if (this.layoutContent[item.i]?.type !== "video") return -1;
                return this.layout.slice(0, idx)
                    .filter((it: any) => this.layoutContent[it.i]?.type === "video").length;
            };
            const v1 = videoIndexOf(id1);
            const v2 = videoIndexOf(id2);
            if (v1 < 0 || v2 < 0 || v1 === v2) return;
            Object.values<Content>(this.layoutContent).forEach((c) => {
                if (c.type !== "chat") return;
                // ChatCell treats an unset value as 0 (?? 0), so match using the same interpretation here
                const tab = c.currentTab ?? 0;
                if (tab === v1) c.currentTab = v2;
                else if (tab === v2) c.currentTab = v1;
            });
        },
    },
    persist: {
        key: "multiview-mv-v1",
        // Upstream Holodex (Vuex) persists the whole multiview module ("multiview" in persistedPaths in store/index.js),
        // so a reload restores the cell layout, each cell's stream and the custom presets. In the Pinia port, layout /
        // layoutContent / presetLayout were missing from pick and that state was lost on reload, so they are included to match upstream.
        pick: ["layout", "layoutContent", "presetLayout", "autoLayout", "ytUrlHistory", "twUrlHistory", "muteOthers", "syncOffsets", "snapIndex", "titleFilter"],
    },
});
