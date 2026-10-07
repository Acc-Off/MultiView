<template>
  <div
    :key="`uid-${uniqueId}`"
    class="cell-content"
  >
    <div
      class="mv-frame ma-auto mb-1"
      :class="{ 'elevation-4': editMode }"
    >
      <!-- Twitch Player -->
      <TwitchPlayer
        v-if="isTwitchVideo"
        ref="player"
        :channel="cellContent.id"
        :plays-inline="true"
        :mute="muted"
        manual-update
        @ready="onReady"
        @ended="editMode = true"
        @playing="onPlayPause(false)"
        @paused="onPlayPause(true)"
        @error="editMode = true"
        @mute="setMuted($event)"
        @volume="volume = $event"
      />
      <!-- Youtube Player -->
      <YoutubePlayer
        v-else
        ref="player"
        :key="cellContent.id"
        :video-id="cellContent.id"
        :player-vars="{
          playsinline: 1,
          cc_lang_pref: getLang,
          hl: getLang,
        }"
        :mute="muted"
        manual-update
        @ready="onReady"
        @ended="editMode = true"
        @playing="onPlayPause(false)"
        @paused="onPlayPause(true)"

        @cued="editMode = true"
        @error="editMode = true"
        @playbackRate="playbackRate = $event"
        @mute="setMuted($event)"
        @volume="volume = $event"
      />
      <!-- The {id}-overlay portal inherited from the fork was removed: nothing ever sent to it, so it was always empty -->
    </div>
    <cell-control
      v-if="editMode"
      @reset="uniqueId = Date.now()"
      @back="resetCell"
      @delete="deleteCell"
    />
  </div>
</template>

<script>
import { mapMutations } from "@/store/helpers";
import { getYTLangFromState } from "@/utils/functions";
import { useSettingsStore } from "@/store/settings.store";
import { useVolumeStore } from "@/store/volume.store";
import YoutubePlayer from "../player/YoutubePlayer.vue";
import TwitchPlayer from "../player/TwitchPlayer.vue";
import CellMixin from "./CellMixin";
import CellControl from "./CellControl.vue";

export default {
    name: "VideoCell",
    components: {
        CellControl,
        TwitchPlayer,
        YoutubePlayer,
    },
    mixins: [CellMixin],
    data() {
        return {
            uniqueId: Date.now(),
            playbackRate: 1,
            volume: 50,
            firstPlay: true,
            // Playback position. SyncBar reads it as cell.currentTime (for synced playback of archives).
            // It updates every 0.5 seconds, so keep it local instead of in the store (layoutContent).
            // Going through the store dirtied layoutContent on every currentTime update and wrote it
            // to localStorage, which caused flickering with multiple windows.
            // currentTime was never in the persist pick and is not restored on reload anyway,
            // so making it local does not change persistence behavior.
            currentTime: 0,

            timer: null,
        };
    },
    computed: {
        isTwitchVideo() {
            const v = this.cellContent?.video;
            return v?.type === "twitch" || v?.channel?.platform === "twitch";
        },
        muted: {
            get() {
                if (!this.cellContent) return false;
                return this.cellContent.muted;
            },
            set(value) {
                if (value !== this.cellContent.muted) {
                    this.mvStore.setLayoutContentWithKey({
                        id: this.item.i,
                        key: "muted",
                        value,
                    });
                }
            },
        },
        video() {
            if (!this.cellContent) return null;
            return this.cellContent.video;
        },
        // Key for persisting volume: the channel ID for YouTube, the channel name (= cellContent.id) for Twitch
        channelKey() {
            if (this.isTwitchVideo) return `twitch:${this.cellContent.id}`;
            const chId = this.video?.channel?.id;
            return chId ? `youtube:${chId}` : null;
        },
        // Saved volume for the channel. Changes from the channel list page or other windows also
        // arrive here, so watch it and apply them to the playing player.
        storedVolume() {
            if (!this.channelKey) return null;
            return useVolumeStore().volumes[this.channelKey] || null;
        },
        isFastFoward() {
            return this.playbackRate !== 1;
        },
        getLang() {
            return getYTLangFromState({ settings: useSettingsStore() });
        },
    },
    watch: {
        cellContent(nw, old) {
            // Handles edge case where twitch player is getting destroyed without notifying
            // This parent, leaving editMode desynced. Alternative is to use the same event @currentTime to sync up
            if (nw.id !== old.id && !this.editMode) this.editMode = true;
            if (!this.isTwitchVideo) this.twPlayer = null;
            else this.ytPlayer = null;

            if (this.editMode) this.mvStore.unfreezeLayoutItem(this.item.i);
            else this.mvStore.freezeLayoutItem(this.item.i);
            this.setTimer();
        },
        // eslint-disable-next-line func-names
        "video.id": function () {
            this.setTimer();
        },
        // Pick up changes from the channel list page, other windows, and other cells of the same channel.
        // Important: only call applyXxx here and never write back to the store. Writing back would cause
        // a receive → write → storage → receive … chain and let window-specific mute state leak in
        // (breaking the assumption in store/index.ts that synced state has no automatic writers).
        // Ignored before restore (onReady→restoreVolume): touching a player that is not ready can
        // overwrite the saved value with the initial one (which is what _volRestored guards against).
        storedVolume: {
            deep: true,
            handler(entry) {
                if (!entry || !this._volRestored) return;
                // Apply only the fields that actually changed in the store.
                // Comparing against the local muted would mistake the difference caused by the
                // muteOthers auto-mute (state that exists only in this window) for a change from
                // another window, and merely changing the volume would undo the auto-mute.
                // Pinia's $patch merges into the existing object in place, so the watcher's
                // oldValue can be the same reference as the new value. Keep the previous value ourselves.
                const prev = this._lastStored || {};
                this._lastStored = { volume: entry.volume, muted: !!entry.muted };
                if (entry.volume !== prev.volume && entry.volume !== this.volume) {
                    this.applyVolume(entry.volume);
                }
                if (!!entry.muted !== !!prev.muted && !!entry.muted !== !!this.muted) {
                    this.applyMuted(!!entry.muted);
                }
            },
        },
    },
    created() {
        // A player instance holds a reference to the (cross-origin) iframe's Window, or the raw
        // YT.Player that the YouTube IFrame API writes its internal state into. Putting it in data()
        // makes Vue wrap it reactively, causing a stream of cross-origin SecurityErrors and
        // "Cannot assign to read only property" errors.
        // So keep them as non-reactive instance fields instead of in data().
        this.ytPlayer = null;
        this.twPlayer = null;
        // Flag for whether volume/mute has been restored (non-reactive).
        // Before restore, manualCheckMuted does not read back the player's actual state, so that
        // right after a reload the saved volume is not overwritten with values from a player that is not ready.
        this._volRestored = false;
        // Copy of the volume entry last read from the store (non-reactive).
        // Used by the watcher to tell whether the store side changed.
        this._lastStored = null;
    },
    mounted() {
        // When mounted, the video is paused, reset edit mode to sync up
        if (!this.editMode) this.editMode = true;
        this.setTimer();
    },
    beforeUnmount() {
        this.timer && clearInterval(this.timer);
    },
    methods: {
        ...mapMutations("multiview", ["applyMuteOthers"]),
        refresh() {
            this.uniqueId = Date.now();
            this.editMode = true;
        },
        // val=true plays, val=false pauses.
        // The old implementation bailed out on `editMode !== val`, but Twitch's pause event is
        // unreliable and editMode can get out of step (staying false even after pausing);
        // in that state play-all hit the early return and did nothing.
        // Drive the player straight to the target state (val) without depending on editMode.
        setPlaying(val) {
            if (this.ytPlayer) {
                val ? this.ytPlayer.playVideo() : this.ytPlayer.pauseVideo();
            }
            if (this.twPlayer) {
                val ? this.twPlayer.play() : this.twPlayer.pause();
            }
        },
        // --- Always keep applying (applyXxx) and saving (persistVolume) separate ---
        // If the path that applies store-originated changes (channel list page, other windows) also
        // saved, persistVolume writes both volume and muted, so this window's own mute state (the
        // muteOthers auto-mute) would leak into the shared entry and mute cells in other windows too.
        // The receiving side only applies.
        applyMuted(val) {
            // isMuted() can return undefined while the player is not ready.
            // `undefined === false` is false, so it used to slip past the early return and reach
            // persistVolume with volume still at its initial value (50), overwriting the saved value.
            // Reject anything that is not a boolean as an invalid read.
            if (typeof val !== "boolean") return false;
            if (val === !!this.muted) return false;
            // Action was done through media controls or youtube player controls. Check to mute all
            if (!val) this.applyMuteOthers(this.item.i);
            this.muted = val;
            return true;
        },
        applyVolume(val) {
            if (this.ytPlayer) this.ytPlayer.setVolume(val);
            if (this.twPlayer) this.twPlayer.setVolume(val / 100);
            this.volume = val;
        },
        setMuted(val) {
            if (!this.applyMuted(val)) return;
            this.persistVolume();
        },
        setVolume(val) {
            this.applyVolume(val);
            this.persistVolume();
        },
        // Save the per-channel volume
        persistVolume() {
            if (!this.channelKey) return;
            this._lastStored = { volume: this.volume, muted: !!this.muted };
            useVolumeStore().setVolume({
                channelKey: this.channelKey,
                volume: this.volume,
                muted: !!this.muted,
            });
        },
        // Restore the saved volume/mute and apply them to the player.
        // They are stored in the same entry the slider on the channel list page uses.
        restoreVolume() {
            if (!this.channelKey) return;
            const saved = useVolumeStore().volumeFor(this.channelKey);
            if (saved) {
                // This applies the saved value; it does not save. Going through setVolume would make
                // persistVolume also write the cell's current muted (including the muteOthers
                // auto-mute) and corrupt the saved mute state.
                this.applyVolume(saved.volume);
                this.applyMuted(!!saved.muted);
                this._lastStored = { volume: saved.volume, muted: !!saved.muted };
            }
            // Record that the restore attempt is done, whether or not there was a saved value.
            // From here on, reading back the player's actual mute state (manualCheckMuted) is allowed.
            // If this were not set when saved is missing, the read-back would stay off forever and
            // actions inside the embed would never be reflected.
            this._volRestored = true;
        },
        togglePlaybackRate() {
            if (!this.ytPlayer) return;
            this.ytPlayer.setPlaybackRate(this.isFastFoward ? 1 : 2);
        },
        setPlaybackRate(val) {
            if (!this.ytPlayer) return;
            this.ytPlayer.setPlaybackRate(val);
        },
        updatePausedState(paused = false) {
            if (this.editMode === paused) return;
            this.editMode = paused;
            if (this.firstPlay && !paused) {
                this.applyMuteOthers(this.item.i);
                this.firstPlay = false;
            }
        },
        onPlayPause(paused = false) {
            if (this.ytPlayer && (!this.ytPlayer.getVideoData().isLive || this.ytPlayer.getVideoData().allowLiveDvr)) {
                setTimeout(() => {
                    const recheck = this.ytPlayer.getPlayerState() === 2;
                    this.updatePausedState(recheck);
                }, 200);
            } else {
                this.updatePausedState(paused);
            }
        },
        onReady(player) {
            // On play it should take focus to new stream
            // ytPlayer/twPlayer are non-reactive instance fields (initialized in created).
            // Keep them as is, without freezing.
            if (player && this.isTwitchVideo) {
                this.twPlayer = player;
            } else if (player) {
                this.ytPlayer = player;
            }
            // Restore the saved volume settings
            this.$nextTick(() => this.restoreVolume());
        },
        manualRefresh() {
            // called when the Media Controller polls for it. Used to update attached listeners with the current state.
            if (!this.$refs.player) return;
            this.$refs.player.updateListeners();
        },
        async manualCheckMuted() {
            // synchronizes the muted state of the PLAYER within with the muted state of the CellContent
            if (!this.$refs.player) return;
            // Do not read back the player's actual state until volume/mute has been restored.
            // Right after a reload, if this polling runs before onReady/restoreVolume, isMuted() on
            // the not-yet-ready player returns undefined and the saved value gets overwritten with
            // volume still at its initial value (the main cause of volume resetting to 50 on reload).
            if (!this._volRestored) return;
            const m = await this.$refs.player.isMuted();
            if (typeof m !== "boolean") return;
            this.setMuted(m);
        },
        setTimer() {
            if (this.timer) clearInterval(this.timer);
            // if (this.video.status !== "past") return;
            this.timer = setInterval(async () => {
                this.currentTime = await this.$refs.player.getCurrentTime();
            }, 500);
        },
        seekTo(t) {
            this.$refs.player.seekTo(t);
        },
    },
};
</script>

<style>
.mv-frame > div > iframe {
    position: absolute;
    width: 100%;
    height: 100%;
}

.mv-frame {
    position: relative;
    width: 100%;
    height: 100%;
}
</style>
