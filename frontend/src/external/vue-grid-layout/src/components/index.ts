// The leftover UMD global auto-install (which assumed window.Vue) was removed in the Vue 3 migration.
// This app imports GridLayout/GridItem directly from MultiView.vue, so it is not needed.
import GridItem from "./GridItem.vue";
import GridLayout from "./GridLayout.vue";

const VueGridLayout = {
    GridLayout,
    GridItem,
};

export default VueGridLayout;
export { GridLayout, GridItem };
