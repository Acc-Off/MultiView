import type { LayoutItem } from "@/external/vue-grid-layout/src/helpers/utils";

export interface Content {
    id?: string;
    type: string;
    isTwitch?: Boolean;
    video?: any;
    currentTab?: number;
    currentTime?: number;
}

/**
 * Internal grid coordinate system, fixed at GRID_COLS columns × GRID_ROWS rows.
 * Videos are 16:9, so the two axes use different division counts (they need not match).
 * - 120 columns = 2³×3×5 … divides into 2, 3, 4, 5, 6, 8, 10, 12… columns of equal cells.
 * - 60 rows     = 2²×3×5 … divides into 2, 3, 4, 5, 6 rows of equal cells.
 * Presets, shared URLs and serialization all use this coordinate system.
 * How coarse the grid feels while editing is controlled in a separate layer (snapStep),
 * so making these values large does not hurt manual layout editing.
 */
export const GRID_COLS = 120;
export const GRID_ROWS = 60;

/**
 * Margin between grid cells (px). It is factored into rowHeight/columnWidth so that the
 * total grid size exactly fits the available area (so that the larger total margin of a
 * 120/60 division causes no overflow or scrollbars).
 */
export const GRID_MARGIN = 1;

/**
 * Snap granularity while editing (rounding unit applied when a move/resize is committed).
 * Only common divisors of GRID_COLS/GRID_ROWS (values that divide both 120 and 60) are used,
 * which always guarantees evenly dividing snaps.
 * Eight levels: every common divisor up to 12. index 0 = coarsest … last = finest. Chosen with a slider.
 * Divisions (columns × rows) per step and the typical column counts that align cleanly:
 *   12→10×5(5,10) / 10→12×6(3,4,6,12) / 6→20×10(4,5,10) / 5→24×12(3,4,6,8) /
 *   4→30×15(2,3,5,6,10,15) / 3→40×20(4,5,8,10) / 2→60×30(nearly all) / 1→120×60(all)
 * The default is step 4 = 30×15 (an all-round granularity that aligns to nearly every column count, including 5; index 4).
 */
export const SNAP_STEPS = Object.freeze([12, 10, 6, 5, 4, 3, 2, 1]);
export const DEFAULT_SNAP_INDEX = 4;

const b64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_.";

/** Encodes x/y/w/h as fixed-width two-digit b64 (0–4095; 120/60 fit comfortably). */
const enc2 = (n: number) => b64[Math.floor(n / 64)] + b64[n % 64];
const dec2 = (s: string) => b64.indexOf(s[0]) * 64 + b64.indexOf(s[1]);

export const sortLayout = (a, b) => a.x - b.x || a.y - b.y;
// export const sortLayout = (a, b) => a.y - b.y || a.x - b.x;

export const generateContentId = () => Array.from({ length: 8 })
    .map(() => b64[Math.floor(Math.random() * b64.length)])
    .join("");

/**
 * Encodes a layout array and contents to a compact URI
 * @param {{layout, contents, includeVideo?}} layout and layout contents
 * @returns {string} encoded string
 */
export function encodeLayout({ layout, contents, includeVideo = false }) {
    const l = [];
    try {
        layout.forEach((item) => {
            let encodedBlock = "";
            let invalid = false;
            ["x", "y", "w", "h"].forEach((key) => {
                // Fixed two-digit width. Can represent 0–4095, which GRID_COLS/GRID_ROWS (120/60) never exceed.
                if (item[key] < 0 || item[key] > 4095) {
                    invalid = true;
                } else {
                    encodedBlock += enc2(item[key]);
                }
            });

            if (invalid) return;

            if (contents[item.i]) {
                const {
                    id, type, video, currentTab,
                } = contents[item.i];
                if (type === "chat") {
                    encodedBlock += `chat${currentTab || 0}`;
                } else if (type === "video" && includeVideo) {
                    if (video?.type === "twitch") {
                        encodedBlock += `twitch${id}`;
                    } else {
                        encodedBlock += id;
                    }
                }
            }
            l.push(encodedBlock);
        });
        return l.join(",");
    } catch (e) {
        console.error(e);
        return "error";
    }
}

/**
 * Decodes a string to layout array and contents
 * @param {string} encodedStr encoded string
 * @returns {{layout, content}} layout and layout contents as array and object
 */
export function decodeLayout(encodedStr) {
    const parsedLayout: LayoutItem[] = [];
    const parsedContent: Record<number, Content> = {};
    let videoCellCount = 0;
    const parts = encodedStr.split(",");
    // Parse xywh as fixed-width two-digit values (8 characters in total), then do a stable numeric sort.
    // The old format used a single fixed-width digit, where lexicographic order equalled ascending x.
    // With two digits and a wider value range, b64 character order no longer always matches numeric
    // order, so this was replaced with an explicit numeric sort.
    parts.sort((a, b) => (dec2(a.substring(0, 2)) - dec2(b.substring(0, 2)))
        || (dec2(a.substring(2, 4)) - dec2(b.substring(2, 4))));
    parts.forEach((str) => {
        const index = generateContentId();
        const xywh = str.substring(0, 8);
        const idOrChat = str.substring(8);
        const isChat = idOrChat.substring(0, 4) === "chat";
        const isTwitch = idOrChat.substring(0, 6) === "twitch";

        const keys = ["x", "y", "w", "h"];
        const layoutItem: LayoutItem = {
            w: 0,
            h: 0,
            x: 0,
            y: 0,
            i: index,
            isDraggable: true,
            isResizable: true,
            moved: false,
        };

        keys.forEach((key, keyIndex) => {
            layoutItem[key] = dec2(xywh.substring(keyIndex * 2, keyIndex * 2 + 2));
        });
        videoCellCount += 1;
        layoutItem.i = index;
        if (isChat) {
            const currentTab = idOrChat.length === 5 ? Number(idOrChat[4]) : -1;
            parsedContent[index] = {
                type: "chat",
                ...(currentTab >= 0) && { currentTab },
            };
            videoCellCount -= 1;
        } else if (isTwitch) {
            const twitchChannel = idOrChat.substring(6);
            parsedContent[index] = {
                type: "video",
                id: twitchChannel,
                video: {
                    id: twitchChannel,
                    type: "twitch",
                    channel: {
                        // The icon dictionary keys Twitch channels by login (= id). Dropping id here would leave
                        // ChannelImg unable to look it up when restoring a shared URL, falling back to the default icon.
                        id: twitchChannel,
                        name: twitchChannel,
                    },
                },
            };
        } else if (idOrChat.length >= 11) {
            // YouTube video ids are always 11 characters. Anything after that is treated as the channel name.
            const ytId = idOrChat.substring(0, 11);
            const channelName = idOrChat.substring(11);
            parsedContent[index] = {
                type: "video",
                id: ytId,
                video: {
                    id: ytId,
                    channel: {
                        name: channelName || ytId,
                    },
                },
            };
        }
        parsedLayout.push(layoutItem);
    });
    // parsedLayout.sort(sortLayout);
    return {
        id: encodedStr,
        layout: parsedLayout,
        content: parsedContent,
        videoCellCount,
    };
}

/**
 * Count the number of empty cells
 * @param {{layout, content}} layout and layout contents
 * @returns {number} count of empty cells
 */
export function getEmptyCells({ layout, content }) {
    return layout.length - Object.values(content).filter((o: Content) => o.type === "chat").length;
}

// Presets are generated in 120×60 coordinates (verified by script: no overlaps, nothing out of bounds, unique names).
// Naming convention (names do not use Japanese):
//   - Uniform grid: "columns×rows" (count across × count down).
//   - With chat: "columns×rows+N💬". N is the number of chat cells (a same-height chat to the right of each video = number of videos / one full-height side chat = 1 / a chat row at the bottom = number of chats in that row).
//   - Mixed sizes (all cells share the same aspect ratio, at non-integer size multiples): "large count+small count" (e.g. 8+10 = 8 large + 10 small).
export const desktopPresets = Object.freeze([
    { layout: "AAAAB4A8", name: "1" },
    { layout: "AAAABsA8,BsAAAMA8chat0", name: "1+1💬", default: 1 },
    { layout: "AAAAA8A8,A8AAA8A8", name: "2×1", default: 2 },
    { layout: "AAAAB4Ae,AAAeB4Ae", name: "1×2" },
    { layout: "AAAAA2A8,A2AAA2A8,BsAAAMA8chat0", name: "2×1+1💬" },
    { layout: "AAAAAoA8,AoAAAoA8,BQAAAoA8", name: "3×1", default: 3 },
    { layout: "AAAAAkA8,AkAAAkA8,BIAAAkA8,BsAAAMA8chat0", name: "3×1+1💬" },
    { layout: "AAAAA8Ae,A8AAA8Ae,AAAeA8Ae,A8AeA8Ae", name: "2×2", default: 4 },
    { layout: "AAAAA2Ae,A2AAA2Ae,AAAeA2Ae,A2AeA2Ae,BsAAAMA8chat0", name: "2×2+1💬" },
    { layout: "AAAAAoAe,AoAAAoAe,BQAAAoAe,AAAeAoAe,AoAeAoAe,BQAeAoAe", name: "3×2", default: 6 },
    { layout: "AAAAA8AU,A8AAA8AU,AAAUA8AU,A8AUA8AU,AAAoA8AU,A8AoA8AU", name: "2×3" },
    { layout: "AAAAAkAe,AkAAAkAe,BIAAAkAe,AAAeAkAe,AkAeAkAe,BIAeAkAe,BsAAAMA8chat0", name: "3×2+1💬" },
    { layout: "AAAAAeAe,AeAAAeAe,A8AAAeAe,BaAAAeAe,AAAeAeAe,AeAeAeAe,A8AeAeAe,BaAeAeAe", name: "4×2", default: 8 },
    { layout: "AAAAA8AP,A8AAA8AP,AAAPA8AP,A8APA8AP,AAAeA8AP,A8AeA8AP,AAAtA8AP,A8AtA8AP", name: "2×4" },
    { layout: "AAAAAoAU,AoAAAoAU,BQAAAoAU,AAAUAoAU,AoAUAoAU,BQAUAoAU,AAAoAoAU,AoAoAoAU,BQAoAoAU", name: "3×3", default: 9 },
    { layout: "AAAAAkAU,AkAAAkAU,BIAAAkAU,AAAUAkAU,AkAUAkAU,BIAUAkAU,AAAoAkAU,AkAoAkAU,BIAoAkAU,BsAAAMA8chat0", name: "3×3+1💬" },
    { layout: "AAAAAeAU,AeAAAeAU,A8AAAeAU,BaAAAeAU,AAAUAeAU,AeAUAeAU,A8AUAeAU,BaAUAeAU,AAAoAeAU,AeAoAeAU,A8AoAeAU,BaAoAeAU", name: "4×3", default: 12 },
    { layout: "AAAAAoAP,AoAAAoAP,BQAAAoAP,AAAPAoAP,AoAPAoAP,BQAPAoAP,AAAeAoAP,AoAeAoAP,BQAeAoAP,AAAtAoAP,AoAtAoAP,BQAtAoAP", name: "3×4" },
    { layout: "AAAAAYAU,AYAAAYAU,AwAAAYAU,BIAAAYAU,BgAAAYAU,AAAUAYAU,AYAUAYAU,AwAUAYAU,BIAUAYAU,BgAUAYAU,AAAoAYAU,AYAoAYAU,AwAoAYAU,BIAoAYAU,BgAoAYAU", name: "5×3", default: 15 },
    { layout: "AAAAAeAP,AeAAAeAP,A8AAAeAP,BaAAAeAP,AAAPAeAP,AeAPAeAP,A8APAeAP,BaAPAeAP,AAAeAeAP,AeAeAeAP,A8AeAeAP,BaAeAeAP,AAAtAeAP,AeAtAeAP,A8AtAeAP,BaAtAeAP", name: "4×4", default: 16 },
    { layout: "AAAAAYAP,AYAAAYAP,AwAAAYAP,BIAAAYAP,BgAAAYAP,AAAPAYAP,AYAPAYAP,AwAPAYAP,BIAPAYAP,BgAPAYAP,AAAeAYAP,AYAeAYAP,AwAeAYAP,BIAeAYAP,BgAeAYAP,AAAtAYAP,AYAtAYAP,AwAtAYAP,BIAtAYAP,BgAtAYAP", name: "5×4", default: 20 },
    { layout: "AAAAAUAP,AUAAAUAP,AoAAAUAP,A8AAAUAP,BQAAAUAP,BkAAAUAP,AAAPAUAP,AUAPAUAP,AoAPAUAP,A8APAUAP,BQAPAUAP,BkAPAUAP,AAAeAUAP,AUAeAUAP,AoAeAUAP,A8AeAUAP,BQAeAUAP,BkAeAUAP,AAAtAUAP,AUAtAUAP,AoAtAUAP,A8AtAUAP,BQAtAUAP,BkAtAUAP", name: "6×4" },
    { layout: "AAAAAPAP,APAAAPAP,AeAAAPAP,AtAAAPAP,A8AAAPAP,BLAAAPAP,BaAAAPAP,BpAAAPAP,AAAPAPAP,APAPAPAP,AeAPAPAP,AtAPAPAP,A8APAPAP,BLAPAPAP,BaAPAPAP,BpAPAPAP,AAAeAPAP,APAeAPAP,AeAeAPAP,AtAeAPAP,A8AeAPAP,BLAeAPAP,BaAeAPAP,BpAeAPAP,AAAtAPAP,APAtAPAP,AeAtAPAP,AtAtAPAP,A8AtAPAP,BLAtAPAP,BaAtAPAP,BpAtAPAP", name: "8×4" },
    { layout: "AAAAAUAM,AUAAAUAM,AoAAAUAM,A8AAAUAM,BQAAAUAM,BkAAAUAM,AAAMAUAM,AUAMAUAM,AoAMAUAM,A8AMAUAM,BQAMAUAM,BkAMAUAM,AAAYAUAM,AUAYAUAM,AoAYAUAM,A8AYAUAM,BQAYAUAM,BkAYAUAM,AAAkAUAM,AUAkAUAM,AoAkAUAM,A8AkAUAM,BQAkAUAM,BkAkAUAM,AAAwAUAM,AUAwAUAM,AoAwAUAM,A8AwAUAM,BQAwAUAM,BkAwAUAM", name: "6×5" },
    { layout: "AAAAAUAK,AUAAAUAK,AoAAAUAK,A8AAAUAK,BQAAAUAK,BkAAAUAK,AAAKAUAK,AUAKAUAK,AoAKAUAK,A8AKAUAK,BQAKAUAK,BkAKAUAK,AAAUAUAK,AUAUAUAK,AoAUAUAK,A8AUAUAK,BQAUAUAK,BkAUAUAK,AAAeAUAK,AUAeAUAK,AoAeAUAK,A8AeAUAK,BQAeAUAK,BkAeAUAK,AAAoAUAK,AUAoAUAK,AoAoAUAK,A8AoAUAK,BQAoAUAK,BkAoAUAK,AAAyAUAK,AUAyAUAK,AoAyAUAK,A8AyAUAK,BQAyAUAK,BkAyAUAK", name: "6×6" },
    // A same-height chat to the right of each video (the standard YouTube/Twitch layout). Number of chats = number of videos.
    { layout: "AAAAAoA8,AoAAAUA8chat0,A8AAAoA8,BkAAAUA8chat0", name: "2×1+2💬" },
    { layout: "AAAABQAe,BQAAAoAechat0,AAAeBQAe,BQAeAoAechat0", name: "1×2+2💬" },
    { layout: "AAAAAbA8,AbAAANA8chat0,AoAAAbA8,BDAAANA8chat0,BQAAAbA8,BrAAANA8chat0", name: "3×1+3💬" },
    { layout: "AAAABQAU,BQAAAoAUchat0,AAAUBQAU,BQAUAoAUchat0,AAAoBQAU,BQAoAoAUchat0", name: "1×3+3💬" },
    { layout: "AAAAAoAe,AoAAAUAechat0,A8AAAoAe,BkAAAUAechat0,AAAeAoAe,AoAeAUAechat0,A8AeAoAe,BkAeAUAechat0", name: "2×2+4💬" },
    // A chat row at the bottom of the video grid (two per column, or one directly under each video). Number of chats = N💬.
    { layout: "AAAAAoAW,AAAWAoAW,AoAAAoAW,AoAWAoAW,BQAAAoAW,BQAWAoAW,AAAsAUAQchat0,AUAsAUAQchat0,AoAsAUAQchat0,A8AsAUAQchat0,BQAsAWAQchat0,BmAsASAQchat0", name: "3×2+6💬" },
    { layout: "AAAAAeAV,AAAVAeAV,AeAAAeAV,AeAVAeAV,A8AAAeAV,A8AVAeAV,BaAAAeAV,BaAVAeAV,AAAqAPASchat0,APAqAPASchat0,AeAqAPASchat0,AtAqAPASchat0,A8AqAPASchat0,BLAqAPASchat0,BaAqAPASchat0,BpAqAPASchat0", name: "4×2+8💬" },
    { layout: "AAAAAoAP,AAAPAoAP,AAAeAoAP,AoAAAoAP,AoAPAoAP,AoAeAoAP,BQAAAoAP,BQAPAoAP,BQAeAoAP,AAAtANAPchat0,ANAtANAPchat0,AaAtAOAPchat0,BCAtAOAPchat0,AoAtANAPchat0,A1AtANAPchat0,BQAtANAPchat0,BdAtANAPchat0,BqAtAOAPchat0", name: "3×3+9💬" },
    { layout: "AAAAAeAP,AAAPAeAP,AAAeAeAP,AeAAAeAP,AeAPAeAP,AeAeAeAP,A8AAAeAP,A8APAeAP,A8AeAeAP,BaAAAeAP,BaAPAeAP,BaAeAeAP,AAAtAPAPchat0,APAtAPAPchat0,AeAtAPAPchat0,AtAtAPAPchat0,A8AtAPAPchat0,BLAtAPAPchat0,BaAtAPAPchat0,BpAtAPAPchat0", name: "4×3+8💬" },
    { layout: "AAAAAYAP,AAAPAYAP,AAAeAYAP,AYAAAYAP,AYAPAYAP,AYAeAYAP,AwAAAYAP,AwAPAYAP,AwAeAYAP,BIAAAYAP,BIAPAYAP,BIAeAYAP,BgAAAYAP,BgAPAYAP,BgAeAYAP,AAAtAMAPchat0,AMAtAMAPchat0,AYAtAMAPchat0,AkAtAMAPchat0,AwAtAMAPchat0,A8AtAMAPchat0,BIAtAMAPchat0,BUAtAMAPchat0,BgAtAMAPchat0,BsAtAMAPchat0", name: "5×3+10💬" },
    { layout: "AAAAAeAM,AAAMAeAM,AAAYAeAM,AAAkAeAM,AeAAAeAM,AeAMAeAM,AeAYAeAM,AeAkAeAM,A8AAAeAM,A8AMAeAM,A8AYAeAM,A8AkAeAM,BaAAAeAM,BaAMAeAM,BaAYAeAM,BaAkAeAM,AAAwAPAMchat0,APAwAPAMchat0,AeAwAPAMchat0,AtAwAPAMchat0,A8AwAPAMchat0,BLAwAPAMchat0,BaAwAPAMchat0,BpAwAPAMchat0", name: "4×4+8💬" },
    { layout: "AAAAAUAP,AAAPAUAP,AAAeAUAP,AAAtAKAPchat0,AKAtAKAPchat0,AUAAAUAP,AUAPAUAP,AUAeAUAP,AUAtAKAPchat0,AeAtAKAPchat0,AoAAAUAP,AoAPAUAP,AoAeAUAP,AoAtAKAPchat0,AyAtAKAPchat0,A8AAAUAP,A8APAUAP,A8AeAUAP,A8AtAKAPchat0,BGAtAKAPchat0,BQAAAUAP,BQAPAUAP,BQAeAUAP,BQAtAKAPchat0,BaAtAKAPchat0,BkAAAUAP,BkAPAUAP,BkAeAUAP,BkAtAKAPchat0,BuAtAKAPchat0", name: "6×3+12💬" },
    { layout: "AAAAAYAM,AAAMAYAM,AAAYAYAM,AAAkAYAM,AAAwAMAMchat2,AMAwAMAMchat3,AYAAAYAM,AYAMAYAM,AYAYAYAM,AYAkAYAM,AYAwAMAMchat6,AkAwAMAMchat7,AwAAAYAM,AwAMAYAM,AwAYAYAM,AwAkAYAM,AwAwAMAMchat10,A8AwAMAMchat11,BIAAAYAM,BIAMAYAM,BIAYAYAM,BIAkAYAM,BIAwAMAMchat14,BUAwAMAMchat15,BgAAAYAM,BgAMAYAM,BgAYAYAM,BgAkAYAM,BgAwAMAMchat18,BsAwAMAMchat19", name: "5×4+10💬" },
    { layout: "AAAAAUAM,AAAMAUAM,AAAYAUAM,AAAkAUAM,AAAwAKAMchat0,AKAwAKAMchat0,AUAAAUAM,AUAMAUAM,AUAYAUAM,AUAkAUAM,AUAwAKAMchat0,AeAwAKAMchat0,AoAAAUAM,AoAMAUAM,AoAYAUAM,AoAkAUAM,AoAwAKAMchat0,AyAwAKAMchat0,A8AAAUAM,A8AMAUAM,A8AYAUAM,A8AkAUAM,A8AwAKAMchat0,BGAwAKAMchat0,BQAAAUAM,BQAMAUAM,BQAYAUAM,BQAkAUAM,BQAwAKAMchat0,BaAwAKAMchat0,BkAAAUAM,BkAMAUAM,BkAYAUAM,BkAkAUAM,BkAwAKAMchat0,BuAwAKAMchat0", name: "6×4+12💬" },
    { layout: "AAAABIAe,AAAeBIAe,BIAAAwAU,BIAUAwAU,BIAoAwAU", name: "5", default: 5 },
    { layout: "AAAABQAo,BQAAAoAU,BQAUAoAU,AAAoAoAU,AoAoAoAU,BQAoAoAU", name: "1+5" },
    { layout: "AAAAAtAe,AtAAAtAe,AAAeAtAe,AtAeAtAe,BaAAAeAU,BaAUAeAU,BaAoAeAU", name: "7", default: 7 },
    { layout: "AAAAAYAe,AYAAAYAe,AwAAAYAe,BIAAAYAe,BgAAAYAe,AAAeAYAe,AYAeAYAe,AwAeAYAe,BIAeAYAe,BgAeAYAe", name: "2×5", default: 10 },
    { layout: "AAAAA8AY,A8AAA8AY,AeAkA8AY,AAAYAeAM,AeAYAeAM,A8AYAeAM,BaAYAeAM,AAAkAeAM,BaAkAeAM,AAAwAeAM,BaAwAeAM", name: "11", default: 11 },
    { layout: "AAAAAwAY,BIAAAwAY,AAAkAwAY,BIAkAwAY,AwAAAYAM,AwAMAYAM,AAAYAYAM,AYAYAYAM,AwAYAYAM,BIAYAYAM,BgAYAYAM,AwAkAYAM,AwAwAYAM", name: "13", default: 13 },
    { layout: "AAAAAtAP,AtAAAtAP,AAAPAtAP,AtAPAtAP,BaAAAeAK,BaAKAeAK,BaAUAeAK,AAAeAtAP,AtAeAtAP,AAAtAtAP,AtAtAtAP,BaAeAeAK,BaAoAeAK,BaAyAeAK", name: "14", default: 14 },
    { layout: "AAAAAwAe,AwAAAYAP,BIAAAYAP,BgAAAYAP,AwAPAYAP,BIAPAYAP,BgAPAYAP,AAAeAYAP,AYAeAYAP,AwAeAYAP,BIAeAYAP,BgAeAYAP,AAAtAYAP,AYAtAYAP,AwAtAYAP,BIAtAYAP,BgAtAYAP", name: "17", default: 17 },
    { layout: "AAAAAUAU,AUAAAUAU,AoAAAUAU,A8AAAUAU,BQAAAUAU,BkAAAUAU,AAAUAUAU,AUAUAUAU,AoAUAUAU,A8AUAUAU,BQAUAUAU,BkAUAUAU,AAAoAUAU,AUAoAUAU,AoAoAUAU,A8AoAUAU,BQAoAUAU,BkAoAUAU", name: "6×3", default: 18 },
    { layout: "AAAAAwAY,BIAkAwAY,AwAAAYAM,BIAAAYAM,BgAAAYAM,AwAMAYAM,BIAMAYAM,BgAMAYAM,AAAYAYAM,AYAYAYAM,AwAYAYAM,BIAYAYAM,BgAYAYAM,AAAkAYAM,AYAkAYAM,AwAkAYAM,AAAwAYAM,AYAwAYAM,AwAwAYAM", name: "19", default: 19 },
    { layout: "AAAAAPAK,APAAAPAK,AeAAAPAK,AtAAAPAK,A8AAAPAK,BLAAAPAK,BaAAAPAK,BpAAAPAK,AAAKAPAK,APAKAPAK,AeAKAPAK,AtAKAPAK,A8AKAPAK,BLAKAPAK,BaAKAPAK,BpAKAPAK,AAAUAPAK,APAUAPAK,AeAUAPAK,AtAUAPAK,A8AUAPAK,BLAUAPAK,BaAUAPAK,BpAUAPAK,AAAeAPAK,APAeAPAK,AeAeAPAK,AtAeAPAK,A8AeAPAK,BLAeAPAK,BaAeAPAK,BpAeAPAK,AAAoAPAK,APAoAPAK,AeAoAPAK,AtAoAPAK,A8AoAPAK,BLAoAPAK,BaAoAPAK,BpAoAPAK,AAAyAPAK,APAyAPAK,AeAyAPAK,AtAyAPAK,A8AyAPAK,BLAyAPAK,BaAyAPAK,BpAyAPAK", name: "8×6" },
    // --- Mixed sizes (large and small cells with the same aspect ratio at non-integer size multiples; layouts that tile exactly, the same kind as "7") ---
    { layout: "AAAAA8Ak,A8AAA8Ak,AAAkAoAY,AoAkAoAY,BQAkAoAY", name: "2+3" },
    { layout: "AAAAAyAe,AyAAAyAe,AAAeAyAe,AyAeAyAe,BkAAAUAM,BkAMAUAM,BkAYAUAM,BkAkAUAM,BkAwAUAM", name: "4+5" },
    { layout: "AAAAAkAe,AkAAAkAe,AAAeAkAe,AkAeAkAe,BIAAAYAU,BgAAAYAU,BIAUAYAU,BgAUAYAU,BIAoAYAU,BgAoAYAU", name: "4+6" },
    { layout: "AAAAAwAU,AAAUAwAU,AAAoAwAU,AwAAAkAP,BUAAAkAP,AwAPAkAP,BUAPAkAP,AwAeAkAP,BUAeAkAP,AwAtAkAP,BUAtAkAP", name: "3+8" },
    { layout: "AAAAAYAP,AAAPAYAP,AAAeAYAP,AAAtAYAP,AYAAAgAU,A4AAAgAU,BYAAAgAU,AYAUAgAU,A4AUAgAU,BYAUAgAU,AYAoAgAU,A4AoAgAU,BYAoAgAU", name: "9+4" },
    { layout: "AAAAAYAe,AYAAAYAe,AwAAAYAe,AAAeAYAe,AYAeAYAe,AwAeAYAe,BIAAAQAU,BYAAAQAU,BoAAAQAU,BIAUAQAU,BYAUAQAU,BoAUAQAU,BIAoAQAU,BYAoAQAU,BoAoAQAU", name: "6+9" },
    { layout: "AAAAAZAe,AZAAAZAe,AyAAAZAe,BLAAAZAe,AAAeAZAe,AZAeAZAe,AyAeAZAe,BLAeAZAe,BkAAAKAM,BuAAAKAM,BkAMAKAM,BuAMAKAM,BkAYAKAM,BuAYAKAM,BkAkAKAM,BuAkAKAM,BkAwAKAM,BuAwAKAM", name: "8+10" },
    { layout: "AAAAAYAe,AAAeAYAe,AYAAAQAU,AoAAAQAU,A4AAAQAU,BIAAAQAU,BYAAAQAU,BoAAAQAU,AYAUAQAU,AoAUAQAU,A4AUAQAU,BIAUAQAU,BYAUAQAU,BoAUAQAU,AYAoAQAU,AoAoAQAU,A4AoAQAU,BIAoAQAU,BYAoAQAU,BoAoAQAU", name: "2+18" },
]);

export const mobilePresets = Object.freeze([
    {
        layout: "AAAAB4Ao,AAAoB4AUchat0",
        name: "Mobile 1",
        emptyCells: 1,
        portrait: true,
    },
    {
        layout: "AAAAB4AY,AAAYB4AY,AAAwB4AMchat0",
        name: "Mobile 2",
        emptyCells: 2,
        portrait: true,
    },
    {
        layout: "AAAAB4AU,AAAUB4AU,AAAoB4AU",
        name: "Mobile 3",
        emptyCells: 3,
        portrait: true,
    },
    { layout: "AAAAA8Ae,A8AAA8Ae,AAAeA8Ae,A8AeA8Ae", name: "Mobile 4", emptyCells: 4 },
]);

export function getDesktopDefaults() {
    const autoLayoutDefaults = [];
    desktopPresets.forEach((preset) => {
        if (preset.default) autoLayoutDefaults[preset.default] = preset.layout;
    });
    return autoLayoutDefaults;
}
