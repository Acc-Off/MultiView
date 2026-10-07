<template>
  <div><div :id="elementId" /></div>
</template>

<script>
import { markRaw } from "vue";
import player from "youtube-player";
import PlayerMixin from "./PlayerMixin";

const UNSTARTED = -1;
const ENDED = 0;
const PLAYING = 1;
const PAUSED = 2;
const BUFFERING = 3;
const CUED = 5;

let pid = 1;
export default {
    name: "YoutubePlayer",
    mixins: [PlayerMixin],
    props: {
        videoId: String,
        playerVars: {
            type: Object,
            default: () => ({}),
        },
    },
    data() {
        pid += 1;
        return {
            events: {
                [UNSTARTED]: "unstarted",
                [PLAYING]: "playing",
                [PAUSED]: "paused",
                [ENDED]: "ended",
                [BUFFERING]: "buffering",
                [CUED]: "cued",
            },
            elementId: `youtube-player-${pid}`,
        };
    },
    computed: {
    },
    watch: {
        videoId: "updatePlayer",
        mute: "setMute",
    },
    beforeUnmount() {
        if (this.player !== null && this.player.destroy) {
            this.player.destroy();
            delete this.player;
        }
    },
    async mounted() {
        window.YTConfig = {
            host: "https://www.youtube.com/iframe_api",
        };

        const host = "https://www.youtube.com";

        // player is only used for method calls and never referenced from the template, so it need not be reactive.
        // Wrapping it in a Vue 3 reactive proxy can break its internal iframe API calls, hence markRaw.
        this.player = markRaw(player(this.elementId, {
            host,
            width: this.width,
            height: this.height,
            videoId: this.videoId,
            playerVars: this.playerVars,
            origin: window.origin,
        }));

        this.player.on("ready", (e) => this.playerReady(e.target));
        this.player.on("stateChange", this.playerStateChange);
        this.player.on("error", this.playerError);
    },
    methods: {
        playerStateChange(e) {
            if (e.data !== null && e.data !== UNSTARTED) {
                this.$emit(this.events[e.data], e.target);
            }
        },
        updatePlayer(videoId) {
            if (!videoId) {
                this.player.stopVideo();
                return;
            }

            const params = { videoId };

            if (typeof this.playerVars.start === "number") {
                params.startSeconds = this.playerVars.start;
            }

            if (typeof this.playerVars.end === "number") {
                params.endSeconds = this.playerVars.end;
            }

            console.log("LoadVideoByID in Vue-Youtube", params);

            if (this.playerVars.autoplay === 1) {
                this.player.loadVideoById(params);
                return;
            }

            this.player.cueVideoById(params);
        },
        setMute(value) {
            if (!this.player) return;
            value ? this.player.mute() : this.player.unMute();
        },
        getCurrentTime() {
            // There are moments when player has no getCurrentTime: while it is still the initial {} (before
            // ready) or after its DOM is destroyed. The race between awaits in updateListeners can slip past
            // the guard there, so check for the function at call time.
            if (typeof this.player?.getCurrentTime !== "function") return undefined;
            return this.player.getCurrentTime();
        },
        getPlaybackRate() {
            return this.player.getPlaybackRate();
        },
        getVolume() {
            return this.player.getVolume();
        },
        isMuted() {
            return this.player.isMuted();
        },
        seekTo(t) {
            this.player.seekTo(t);
        },
        setPlaying(playing) {
            if (!this.player) return;
            !playing ? this.player.pauseVideo() : this.player.playVideo();
        },
        async sendLikeEvent() {
            const iframe = await this.player.getIframe();
            iframe.contentWindow.postMessage({ event: "likeVideo" }, "*");
        },
    },
};
</script>
