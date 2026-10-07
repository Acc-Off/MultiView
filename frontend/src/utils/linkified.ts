import * as linkify from "linkifyjs";
import type { Directive } from "vue";

// Replacement for the old vue-linkify: a Vue 3 directive that turns URLs in an element's text/HTML into <a> links.
// Tokenizes with linkifyjs and converts only the link tokens to <a target="_blank" rel="noopener">.
function linkifyElement(el: HTMLElement) {
    const tokens = linkify.tokenize(el.textContent || "");
    // Do nothing if there are no links (so that existing markup inserted via v-html is not destroyed).
    if (!tokens.some((t) => t.isLink)) return;
    const html = tokens
        .map((t) => {
            if (t.isLink) {
                const href = t.toHref();
                return `<a href="${href}" target="_blank" rel="noopener noreferrer">${t.toString()}</a>`;
            }
            // Leave text tokens as is (HTML that came in via v-html is intentionally left untouched).
            return t.toString();
        })
        .join("");
    el.innerHTML = html;
}

export const linkified: Directive<HTMLElement> = {
    mounted(el) {
        linkifyElement(el);
    },
    updated(el) {
        linkifyElement(el);
    },
};

export default linkified;
