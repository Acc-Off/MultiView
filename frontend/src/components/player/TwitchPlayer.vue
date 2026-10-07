<template>
  <div :id="elementId" />
</template>

<script>
import { markRaw } from "vue";
import { loadScript } from "@/utils/loadScript";
import PlayerMixin from "./PlayerMixin";

let pid = 0;

export default {
    name: "TwitchPlayer",
    mixins: [PlayerMixin],
    props: {
        quality: {
            type: String,
            default: "medium",
        },
        mute: {
            type: Boolean,
            default: false,
        },
        playsInline: {
            type: Boolean,
            default: false,
        },
        channel: {
            type: String,
            default: "",
        },
        video: {
            type: String,
            default: "",
        },
    },
    data() {
        pid += 1;
        return {
            player: {},
            elementId: `twitch-player-${pid}`,
        };
    },
    watch: {
        // In transient states (before ready, or after teardown) this.player is still the initial {} with no methods.
        // A watcher firing in that window would throw "is not a function", so each one guards against it.
        channel(newChannel) {
            if (typeof this.player.setChannel !== "function") return;
            this.player.setChannel(newChannel);
        },
        video(newVideo) {
            if (typeof this.player.setVideo !== "function") return;
            this.player.setVideo(newVideo);
        },
        // quality(newQuality) {
        //     if (this.player.getQualities().indexOf(newQuality) !== -1) {
        //         this.player.setQuality(newQuality);
        //     }
        // },
        mute(value) {
            if (typeof this.player.setMuted !== "function") return;
            this.player.setMuted(value);
        },
    },
    beforeUnmount() {
        if (this.player !== null) {
            this.$emit("paused");
            delete this.player;
        }
    },
    beforeCreate() {
        loadScript("https://player.twitch.tv/js/embed/v1.js")
            .then(() => {
                // Applying a preset (among other things) can put the layout in a transient state where it
                // briefly has two items and then drops back to one, creating a short-lived TwitchPlayer that
                // is destroyed right away. loadScript is async, so if .then fires after teardown, this
                // component's DOM element (elementId) is already gone and new Twitch.Player() throws
                // MissingElementError. this.player then stays {}, and VideoCell's setTimer/manualCheckMuted
                // and the mute watcher keep calling it, flooding the console with
                // "getMuted/getCurrentTime/setMuted is not a function" (a zombie player).
                // No DOM element means we were already destroyed, so quietly bail out without creating a player.
                if (!document.getElementById(this.elementId)) return;
                const options = {
                    width: this.width,
                    height: this.height,
                    parent: [window.location.hostname],
                    autoplay: false,
                };
                if (this.playsInline) {
                    options.playsinline = true;
                }
                if (this.channel) {
                    options.channel = this.channel;
                } else if (this.video) {
                    options.video = this.video;
                } else {
                    this.$emit("error", "no source specified");
                }
                // The Twitch player holds a reference to the Window of its cross-origin iframe.
                // Making it reactive has Vue's dependency tracking read properties on that Window
                // (__v_isRef, etc.), which triggers a stream of cross-origin SecurityErrors.
                // With Vue 3, markRaw keeps it out of reactive conversion.
                // Note: the previous Object.freeze approach breaks behind Vue 3's reactive proxy: prototype
                //   method lookup fails and getCurrentTime/play etc. become "is not a function".
                this.player = markRaw(new window.Twitch.Player(this.elementId, options));
                this.player.addEventListener("ended", () => this.$emit("ended"));
                this.player.addEventListener("pause", () => this.$emit("paused"));
                this.player.addEventListener("play", () => this.$emit("playing"));
                // this.player.addEventListener("offline", () => this.$emit("offline"));
                // this.player.addEventListener("online", () => this.$emit("online"));
                this.player.addEventListener("ready", () => {
                    this.player.setQuality(this.quality);
                    this.playerReady(this.player);
                });
            })
            .catch((e) => this.playerError(e));
    },
    methods: {
        play() {
            // Begins playing the specified video.
            this.player.play();
        },
        pause() {
            // Pauses the player.
            this.player.pause();
        },
        getCurrentTime() {
            // Returns the current video’s timestamp, in seconds. Works only for VODs, not live streams.
            if (typeof this.player.getCurrentTime !== "function") return 0;
            return this.player.getCurrentTime();
        },
        getVolume() {
            // Returns the volume level, a value between 0.0 and 1.0.
            if (typeof this.player.getVolume !== "function") return 0;
            return this.player.getVolume() * 100;
        },
        setVolume(value) {
            // Twitch's setVolume takes 0.0-1.0. VideoCell is expected to pass a value already divided by 100.
            if (!this.player || !this.player.setVolume) return;
            this.player.setVolume(value);
        },
        isMuted() {
            // Returns true if the player is muted; otherwise, false.
            if (typeof this.player.getMuted !== "function") return false;
            return this.player.getMuted();
        },
        setMute(value) {
            if (typeof this.player.setMuted !== "function") return;
            this.player.setMuted(value);
        },
        setPlaying(playing) {
            if (!this.player) return;
            !playing ? this.player.pause() : this.player.play();
        },
    },
};
</script>
