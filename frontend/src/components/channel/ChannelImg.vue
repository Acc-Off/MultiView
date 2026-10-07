<template>
  <!-- Render with opaque response for cache if size is lte 40 -->
  <a
    v-if="!err"
    :title=" channel.name +
      (channel.english_name ? `\nEN: ${channel.english_name}` : '') +
      (channel.org ? `\n> ${channel.org}` : '') +
      (channel.group ? `\n> ${channel.group}` : '') "
  >
    <!-- Vuetify 3's v-lazy with tag="img" does not render an <img src> (it does not forward src/@error).
         Native loading="lazy" on an img covers lazy loading well enough, so use a plain img instead. -->
    <img
      :src="photo"
      crossorigin="anonymous"
      loading="lazy"
      :width="size"
      :height="size"
      class="d-block"
      :class="rounded && 'rounded-circle'"
      @error="err = true"
    >
  </a>
  <v-avatar
    v-else
    color="secondary"
    :size="size"
    :title="channel.name"
    style="min-width: 0px"
  >
    <v-icon>
      {{ icons.mdiAccountCircleOutline }}
    </v-icon>
  </v-avatar>
</template>

<script lang="ts">
import { getChannelPhoto, resizeChannelPhoto } from "@/utils/functions";
import { useHomeStore } from "@/store/home.store";

export default {
    name: "ChannelImg",
    props: {
        channel: {
            type: Object,
            required: true,
        },
        size: {
            type: [String, Number],
            default: 40,
        },
        noAlt: {
            type: Boolean,
            default: false,
        },
        rounded: {
            type: Boolean,
            default: false,
        },
    },
    data() {
        return {
            err: false,
        };
    },
    computed: {
        photo() {
            // The single source for icons is GET /api/channels (fetched at startup; home.channels).
            // Look the URL up in its id-to-URL map, falling back to getChannelPhoto only when there is no entry.
            const home = useHomeStore();
            // For a YouTube cell restored from a shared URL, oembed only returns /@handle, so no UC id is available.
            // channel.id then holds the name and cannot be looked up, so fall back to the handle-to-URL map.
            // Precedence: an id (UC id / Twitch login) match first, then a handle match.
            const url = home.channelThumbnails[this.channel.id]
                || (this.channel.handle ? home.channelThumbnailsByHandle[this.channel.handle] : undefined);
            if (url) {
                // YouTube icons use the Google Photos "=s" size format, so request an optimized size.
                // Twitch's profile_image_url has no "=s", so use it as is.
                return url.includes("=s") ? resizeChannelPhoto(url, Number(this.size)) : url;
            }
            return getChannelPhoto(this.channel.id, this.size);
        },
    },
    watch: {
        // Right after restoring from a shared URL, this renders before channel.id is known, so
        // getChannelPhoto(undefined) 404s and err sticks at true. Even after the oembed backfill / Twitch
        // lookup fills in channel.id and photo becomes a valid URL, err stays set and the placeholder
        // avatar remains. Reset err whenever the effective src changes so the img can be fetched again.
        photo() {
            this.err = false;
        },
    },
};
</script>

<style scoped>
img:hover {
    cursor: pointer;
}
</style>
