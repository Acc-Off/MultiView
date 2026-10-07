import { useSettingsStore } from "@/store/settings.store";

export default {
    methods: {
        // MultiView drops the org / mentions-based filters.
        // Only the exclusion of blocked channels, ignored topics, placeholders and missing streams remains.
        filterVideos(v, {
            ignoreBlock = false,
            hideIgnoredTopics = true,
            hidePlaceholder = false,
            hideMissing = false,
        } = {}) {
            const settings = useSettingsStore();
            const blockedChannels = settings.blockedChannelIDs;
            const ignoredTopics = settings.ignoredTopicsSet;

            let keep = true;
            const channelId = v.channel_id || v.channel?.id;

            if (!ignoreBlock) {
                keep &&= !blockedChannels.has(channelId);
            }
            if (hideIgnoredTopics) {
                keep &&= !ignoredTopics.has(v.topic_id);
            }
            if (hidePlaceholder) {
                keep &&= v.type !== "placeholder";
            }
            if (hideMissing) {
                keep &&= v.status !== "missing";
            }
            return keep;
        },
    },
};
