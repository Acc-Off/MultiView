<template>
  <div class="d-flex cell-control flex-wrap">
    <v-btn
      v-if="$attrs.onBack"
      size="small"
      variant="flat"
      elevation="0"
      color="amber-darken-2"
      class="return-btn mr-auto"
      @click="$emit('back')"
    >
      <v-icon end>
        {{ mdiArrowLeftCircle }}
      </v-icon>
    </v-btn>
    <v-btn
      v-if="$attrs.onPlaypause"
      size="small"
      variant="flat"
      elevation="0"
      color="primary"
      class="ml-2 px-md-8"
      @click="$emit('playpause')"
    >
      <v-icon>{{ playIcon }}</v-icon>
    </v-btn>
    <v-btn
      v-if="$attrs.onReset"
      size="small"
      variant="flat"
      elevation="0"
      color="secondary"
      class="ml-2 mr-0"
      @click="$emit('reset')"
    >
      <v-icon>{{ icons.mdiRefresh }}</v-icon>
    </v-btn>
    <v-hover v-slot="{ isHovering }">
      <v-btn
        size="small"
        variant="flat"
        elevation="0"
        color="deep-orange-darken-1"
        class="ml-auto mr-2"
        @click="$emit('delete')"
      >
        <v-icon>{{ isHovering ? mdiDeleteEmpty : icons.mdiDelete }}</v-icon>
      </v-btn>
    </v-hover>
  </div>
</template>

<script lang="ts">
import { mdiArrowLeftCircle, mdiDeleteEmpty } from "@mdi/js";

export default {
    props: {
        playIcon: {
            type: String,
        },
    },
    data() {
        return { mdiDeleteEmpty, mdiArrowLeftCircle };
    },
};
</script>

<style>
.mobile-helpers .cell-control {
  margin: 0 -5px;
}
.cell-control {
  margin: 0 -20px;
}
.mobile-helpers .cell-control .returnbtn {
  width: 25px;
  min-width: 40px;
}

.cell-control .v-btn {
  color: white;
}
/* Match the small button dimensions of upstream Holodex (Vuetify 2): 28px high, modest padding, no min-width.
   Vuetify 3's size="small" defaults to a larger height, horizontal padding and min-width, so it looks one size bigger.
   The icons are left alone: upstream (Vuetify 2 small) also keeps them at the default 24px. */
.cell-control .v-btn.v-btn--size-small {
  height: 28px;
  min-width: 0;
  padding: 0 12px;
  font-size: 0.75rem;
}
/* Vuetify 3's v-icon resolves its own color instead of inheriting currentColor, so the parent's color:white has no effect.
   Set the icons inside buttons to white explicitly (in Vuetify 2 the color:white above was enough). */
.cell-control .v-btn .v-icon {
  color: white;
}
/* Measured in upstream Holodex: refresh/delete icons are 24px, the back icon (v-icon right) is 18px.
   Vuetify 3's size="small" button shrinks every icon to 15px, so restore the upstream sizes explicitly. */
.cell-control .v-btn .v-icon {
  font-size: 24px;
}
.cell-control .return-btn .v-icon {
  font-size: 18px;
}

.cell-control .return-btn {
    border-radius: 0 0 0 0;
    width: 60px;
    margin-right: 10px;
    position: relative;
}

.return-btn::after {
    transition: width 0.1s, right 0.1s;

    content: "";
    width: 10px;
    position: absolute;
    right: -8px;
    background-color: inherit;
    height: 100%;
    border-radius: 0 6px 6px 0;
}
.return-btn:hover::after {
    content: "";
    width: 18px;
    position: absolute;
    right: -16px;
    background-color: inherit;
    height: 100%;
    border-radius: 0 6px 6px 0;
}
</style>
