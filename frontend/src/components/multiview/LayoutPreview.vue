<template>
  <div class="layout-preview" :class="{ 'theme--light': !$vuetify.theme.global.current.dark }" :style="size">
    <template v-for="l in layout" :key="l.i">
      <div class="layout-preview-cell" :style="getStyle(l)">
        <span v-if="content && content[l.i] && content[l.i].type === 'chat'">💬</span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { GRID_COLS, GRID_ROWS } from "@/utils/mv-utils";

export default {
    name: "LayoutPreview",
    props: {
        layout: {
            type: Array,
            required: true,
        },
        content: {
            type: Object,
            required: false,
        },
        mobile: {
            type: Boolean,
            default: false,
        },
        scale: {
            type: Number,
            default: 1,
        },
    },
    computed: {
        size() {
            const width = this.scale * (this.mobile ? 108 : 192);
            const height = this.scale * (this.mobile ? 192 : 108);
            return {
                width: `${width}px`,
                height: `${height}px`,
            };
        },
    },
    methods: {
        getStyle(l) {
            // The internal coordinate system is GRID_COLS columns wide by GRID_ROWS rows tall. The two axes
            // have different division counts, so x/w are converted to percentages against the columns and
            // y/h against the rows.
            const pxX = (num) => `${num * (100 / GRID_COLS)}%`;
            const pxY = (num) => `${num * (100 / GRID_ROWS)}%`;
            return {
                top: pxY(l.y),
                left: pxX(l.x),
                width: pxX(l.w),
                height: pxY(l.h),
                // Vuetify 3: colors live at theme.current.colors.<name> (a hex string; the old parsedTheme.X.base is gone).
                ...(this.content && this.content[l.i] && this.content[l.i].type === "chat"
                    ? { "background-color": `${this.$vuetify.theme.current.colors.warning}44` }
                    : { "background-color": `${this.$vuetify.theme.current.colors.info}44` }),
            };
        },
    },
};
</script>

<style>
.layout-preview {
    /* display: inline-block; */
    border: 2px solid #424242;
    background-color: #424242;
    position: relative;
    overflow: hidden;
}

.layout-preview-cell {
    position: absolute;
    border: 2px solid #424242;
    background-color: #9e9e9e;
    box-sizing: border-box;
    display: flex;
    justify-content: center;
    align-items: center;
}

.layout-preview.theme--light > .cell > span {
    color: black;
}

.layout-preview.theme--light {
    border-color: #f5f5f5;
    background-color: #f5f5f5;
}
.layout-preview.theme--light > .cell {
    border-color: #f5f5f5;
    background-color: #e0e0e0;
}
</style>
