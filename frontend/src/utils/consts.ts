/* eslint-disable no-useless-escape,max-len */
export const CHANNEL_URL_REGEX = /(?:(?:https?:|)\/\/|)(?:www\.|)(?:youtube\.com\/|\/?)channel\/(?<id>[\w-]+)/i;

// YouTube's author_url now uses the /@handle form (this is what oembed returns, not /channel/UC…).
// Extracts the @handle part so that the channel icon dictionary can be looked up by handle.
export const CHANNEL_HANDLE_URL_REGEX = /(?:(?:https?:|)\/\/|)(?:www\.|)youtube\.com\/@(?<handle>[\w.-]+)/i;

export const VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)((?:www|m)\.|)(?<domain>youtube\.com|youtu\.be)\/(?:[\w-]+\?v=|embed|v|watch|live|)\/?(?<id>[\w-]{11})/i;

export const TWITCH_VIDEO_URL_REGEX = /(?:(?:https?:|)\/\/|)twitch\.tv\/(?<id>[\w-]+)/i;

export const TWITCH_UNLIVE_VIDEO_URL_REGEX = /(?:https:\/\/)?twitch\.tv\/videos\/([\w\-_]*)/i;

export const TWITCAST_VIDEO_URL_REGEX = /(?:https:\/\/)?twitcasting\.tv\/(.*)/i;

export const TWITCAST_UNLIVE_VIDEO_URL_REGEX = /(?:https:\/\/)?twitcasting\.tv\/(.*)\/movie\/([\w\-_]*)/i;

export const NICONICO_VIDEO_URL_REGEX = /(?:https:\/\/)?live\.nicovideo\.jp\/watch\/([\w\-_]*)/i;

export const NICONICO_UNLIVE_VIDEO_URL_REGEX = /(?:https:\/\/)?nicovideo\.jp\/watch\/([\w\-_]*)/i;

export const BILIBILI_VIDEO_URL_REGEX = /(?:https:\/\/)?live\.bilibili\.com\/([\w\-_]*)/i;

export const BILIBILI_UNLIVE_VIDEO_URL_REGEX = /(?:https:\/\/)?bilibili\.com\/video\/([\w\-_]*)/i;

export const TL_LANGS = Object.freeze([
    {
        text: "English",
        value: "en",
    },
    {
        text: "日本語",
        value: "ja",
    },
    {
        text: "Español",
        value: "es",
    },
    {
        text: "中文",
        value: "zh",
    },
    {
        text: "Bahasa Indonesia / Melayu",
        value: "id",
    },
    {
        text: "Русский язык",
        value: "ru",
    },
    {
        text: "한국어",
        value: "ko",
    },
    {
        text: "Tiếng Việt",
        value: "vi",
    },
    {
        text: "TLDex-LIVE (test system)",
        value: "tl",
    },
]);

// Language code conversion for YouTube frame
export const langConversion = Object.freeze({
    zh: "zh-Hant",
    "zh-CN": "zh-Hans",
    "en-GB": "enm",
});
