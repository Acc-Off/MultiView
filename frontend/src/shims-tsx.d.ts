import type { VNode } from "vue";

declare global {
    namespace JSX {
        // tslint:disable no-empty-interface
        interface Element extends VNode { }
        // Vue 3 has no Vue class export, so this stays an empty interface.
        // tslint:disable no-empty-interface
        // eslint-disable-next-line @typescript-eslint/no-empty-interface
        interface ElementClass { }
        interface IntrinsicElements {
            [elem: string]: any;
        }
    }
    interface Window {
        Twitch: any; // Twitch object for TLScriptEditor
        onYouTubeIframeAPIReady: any; // callback function?
        YT: any // YT object for TL Script Editor
    }

}
