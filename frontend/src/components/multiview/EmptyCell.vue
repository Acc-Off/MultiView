<template>
  <!-- When Cell has no content: show video picker -->
  <div class="cell-content pt-4">
    <!--================= No Content Mode ================-->
    <div class="centered-btn">
      <v-btn
        class=""
        color="indigo-darken-1"
        rounded-sm
        width="190px"
        size="large"
        @click="$emit('showSelector', item.i)"
      >
        <v-icon start>
          {{ mdiVideoPlus }}
        </v-icon> {{ $t('views.multiview.video.selectLive') }}
      </v-btn>
      <v-btn
        class="mt-2"
        color="teal-darken-1"
        rounded-sm
        width="190px"
        size="large"
        @click="setItemAsChat(item)"
      >
        <v-icon start>
          {{ icons.ytChat }}
        </v-icon>
        Chat
      </v-btn>
    </div>
    <CellControl :play-icon="icons.mdiPlay" class="mx-1 mb-2" @delete="deleteCell" />
  </div>
</template>

<script class="ts">
import { mdiVideoPlus } from "@mdi/js";
import CellMixin from "./CellMixin";
import CellControl from "./CellControl.vue";

export default {
    components: {
        CellControl,
    },
    mixins: [CellMixin],
    data() {
        return {
            mdiVideoPlus,
        };
    },
};
</script>

<style lang="scss" scoped>
.centered-btn {
    display: flex;
    flex-grow: 1;
    flex-shrink: 1;
    justify-content: center;
    align-items: center;
    overflow: hidden;
    position: relative;
    flex-direction: column;

    .v-btn {
      color: white !important;
    }
}
</style>
