<template>
  <div class="v-list-item__content">
    <v-list-item-title style="align-self: flex-start">
      <span class="no-decoration text-truncate">
        {{ channelName }}
      </span>
    </v-list-item-title>
    <v-list-item-subtitle v-if="!noSubscriberCount && channel.subscriber_count">
      <span class="subscriber-count">
        {{ subscriberCount }}
      </span>
    </v-list-item-subtitle>
    <slot />
  </div>
</template>

<script lang="ts">
import { formatCount } from "@/utils/functions";
import { useSettingsStore } from "@/store/settings.store";

export default {
    name: "ChannelInfo",
    props: {
        channel: {
            type: Object,
            required: true,
        },
        noSubscriberCount: {
            type: Boolean,
            default: false,
        },
        noGroup: {
            type: Boolean,
            default: false,
        },
    },
    computed: {
        subscriberCount() {
            if (this.channel.subscriber_count) {
                return this.$t("component.channelInfo.subscriberCount", {
                    n: formatCount(this.channel.subscriber_count, useSettingsStore().lang),
                });
            }
            return this.$t("component.channelInfo.subscriberNA");
        },
        channelName() {
            const prop = useSettingsStore().nameProperty;
            if (this.channel[prop]) return this.channel[prop];
            return this.channel.name;
        },
    },
    methods: {
        formatCount,
    },
};
</script>

<style scoped>
</style>
