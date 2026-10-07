<template>
  <!-- Drawn in the color of the surrounding text (the app bar's foreground) rather than in theme
       colors: the bar itself is theme-colored, and a logo in the same hues would blend into it. -->
  <svg
    width="48"
    height="48"
    version="1.1"
    viewBox="0 0 48 48"
    xmlns="http://www.w3.org/2000/svg"
    style="margin-right: 3px"
    class="logo"
  >
    <!-- One large pane with a play mark cut out of it, surrounded by five small, dimmer panes. -->
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M9 3h15a6 6 0 0 1 6 6v15a6 6 0 0 1-6 6H9a6 6 0 0 1-6-6V9a6 6 0 0 1 6-6ZM12.8 9.9v13.2L24 16.5Z"
    />
    <g fill="currentColor" opacity="0.55">
      <rect x="33" y="3" width="12" height="12" rx="3.2" />
      <rect x="33" y="18" width="12" height="12" rx="3.2" />
      <rect x="33" y="33" width="12" height="12" rx="3.2" />
      <rect x="3" y="33" width="12" height="12" rx="3.2" />
      <rect x="18" y="33" width="12" height="12" rx="3.2" />
    </g>
  </svg>
</template>

<script lang="ts">
export default {
    name: "Logo",
};
</script>
