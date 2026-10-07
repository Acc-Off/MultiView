<template>
  <v-row>
    <v-col
      cols="12"
      class="ma-auto text-center"
    >
      <div class="text-h4">
        <v-btn size="small" href="/">
          <v-icon>{{ icons.mdiRefresh }}</v-icon>
        </v-btn>
        {{ $t("component.apiError.title") }}
      </div>
      <div class="text-body-1">
        {{ $t("component.apiError.text") }}
        <br>
        Tip: Hard Refresh/Clear Cache: <code>CTRL + SHIFT + R</code>
      </div>
    </v-col>
  </v-row>
</template>

<script lang="ts">
export default {
    name: "ApiErrorMessage",
    data() {
        return {
            unclean: false,
        };
    },
    deactivated() {
        if (this.unclean) {
            window.location.reload();
        }
    },
};
</script>

<style>

</style>
