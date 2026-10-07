let pid = 1;

export default {
  props: {
    height: {
      type: [Number, String],
      default: 720,
    },
    width: {
      type: [Number, String],
      default: 1280,
    },
    mute: {
      type: Boolean,
      default: false,
    },
    // interval to refresh currentTime/mute/playbackRate
    refreshRate: {
      type: Number,
      default: 500,
    },
    // Don't initialize interval
    manualUpdate: {
      type: Boolean,
    },
  },
  data() {
    pid += 1;
    // mengen retry mechanism https://discord.com/channels/796190073271353385/801759432450375700/1007899810793259049
    return {
      player: {},
      retryForMengen: false,
      updateTimer: null,
    };
  },
  beforeUnmount() {
    if (this.updateTimer) {
      clearInterval(this.updateTimer);
      this.updateTimer = null;
    }
  },
  methods: {
    playerReady(player) {
      this.setMute(this.mute);
      this.initListeners();
      this.$emit("ready", player);
      this.retryForMengen = false;
    },
    playerError(e) {
      console.log(`[PLAYER ERROR] - ${this.elementId}`);
      console.error(e);
      if (!this.retryForMengen && e.data === "150") {
        e.target.loadVideoById(e.target.getVideoData().video_id);
        this.retryForMengen = true;
      } else {
        this.$emit("error", e);
      }
    },
    getCurrentTime() {
      /* no-op */
    },
    getPlaybackRate() {
      /* no-op */
    },
    getVolume() {
      /* no-op */
    },
    isMuted() {
      /* no-op */
    },
    setPlaying(playing) {
      /* no-op */
    },
    initListeners() {
      if (this.manualUpdate) return;
      // Could consider using .sync two way prop, but ytPlayer makes it kind of makes it hard
      const updateCurrentTime = this.$attrs.onCurrentTime;
      const updatePlaybackRate = this.$attrs.onPlaybackRate;
      const updateMute = this.$attrs.onMute;
      const updateVolume = this.$attrs.onVolume;
      // Only start the loop if at least one listener is on
      if (
        updateVolume
        || updateCurrentTime
        || updatePlaybackRate
        || updateMute
      ) {
        this.updateTimer = setInterval(this.updateListeners, this.refreshRate);
      }
    },
    async updateListeners() {
      const l = this.$attrs;
      // player starts as {} (PlayerMixin.data), so its getters are undefined until mounted assigns the real one.
      // If this timer fires before ready, {}.getCurrentTime() throws a flood of "is not a function"
      // errors (surfaced by Vue 3, which changed the lifecycle/timer firing order).
      // Skip until the player's methods exist; once it is ready this behaves as before.
      const p = this.player as any;
      if (!p || typeof p.getCurrentTime !== "function") return;
      if (l.onMute) this.$emit("mute", await this.isMuted());
      if (l.onPlaybackRate) {
        this.$emit("playbackRate", await this.getPlaybackRate());
      }
      if (l.onCurrentTime) this.$emit("currentTime", await this.getCurrentTime());
      if (l.onVolume) this.$emit("volume", await this.getVolume());
    },
  },
};
