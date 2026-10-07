/* eslint-disable no-shadow */
import { defineStore } from "pinia";

function defaultState() {
    return {
        firstVisit: true,
        showUpdateDetails: false,

        isMobile: true,
        currentGridSize: 0,

        // MainNav Extension slot for tabs on mobile
        showExtension: false,
        // Open/Close Nav drawer
        navDrawer: false,

        // Shared video card dots menu, teleports around
        videoCardMenu: null,
        showVideoCardMenu: false,

        // Document.visiblityState (eg. backgrounded)
        visibilityState: null,
    };
}

export const useRootStore = defineStore("root", {
    state: defaultState,
    actions: {
        setShowUpdatesDetail(payload) {
            this.showUpdateDetails = payload;
        },
        resetState() {
            Object.assign(this, defaultState());
        },
        setIsMobile(val) {
            this.isMobile = val;
        },
        setNavDrawer(val) {
            this.navDrawer = val;
        },
        setVisited() {
            this.firstVisit = false;
        },
        setCurrentGridSize(size) {
            this.currentGridSize = size;
        },
        setShowExtension(show) {
            this.showExtension = show;
        },
        setVideoCardMenu(obj) {
            this.videoCardMenu = obj;
        },
        setShowVideoCardMenu(show) {
            this.showVideoCardMenu = show;
        },
        setVisiblityState(val) {
            this.visibilityState = val;
        },
        // eslint-disable-next-line no-unused-vars
        async reloadCurrentPage(consumed) {
            return consumed;
        },
    },
    persist: {
        key: "multiview-root-v1",
        pick: ["firstVisit", "showUpdateDetails", "currentGridSize"],
    },
});
