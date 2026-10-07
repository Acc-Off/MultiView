import { mapState, mapGetters } from "@/store/helpers";
import { useMultiviewStore } from "@/store/multiview.store";

export default {
    name: "Cell",
    props: {
        item: {
            type: Object,
            required: true,
        },
    },
    computed: {
        ...mapGetters("multiview", ["activeVideos"]),
        ...mapState("multiview", ["layoutContent"]),
        mvStore() {
            return useMultiviewStore();
        },
        editMode: {
            get() {
                if (!this.layoutContent[this.item.i]) return false;
                return this.layoutContent[this.item.i].editMode ?? true;
            },
            set(value) {
                this.mvStore.setLayoutContentWithKey({ id: this.item.i, key: "editMode", value });
            },
        },
        cellContent() {
            return this.layoutContent[this.item.i];
        },
        isChat() {
            return this.cellContent?.type === "chat";
        },
        isVideo() {
            return this.cellContent?.type === "video";
        },
    },
    methods: {
        refresh() {
            this.uniqueId = Date.now();
            this.editMode = true;
        },
        setItemAsChat(item) {
            this.mvStore.setLayoutContentById({
                id: item.i,
                content: {
                    type: "chat",
                },
            });
        },
        deleteCell() {
            this.$emit("delete", this.item.i);
        },
        resetCell() {
            this.mvStore.deleteLayoutContent(this.item.i);
        },
    },
};
