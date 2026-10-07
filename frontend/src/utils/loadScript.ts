// Small utility that loads external JS by dynamically inserting a <script> tag.
// Replaces the old vue-plugin-load-script (each src is loaded only once; later calls return the cached Promise).
const cache = new Map<string, Promise<void>>();

export function loadScript(src: string): Promise<void> {
    if (cache.has(src)) return cache.get(src)!;
    const p = new Promise<void>((resolve, reject) => {
        const el = document.createElement("script");
        el.async = true;
        el.src = src;
        el.addEventListener("load", () => resolve());
        el.addEventListener("error", () => {
            cache.delete(src);
            reject(new Error(`Failed to load script: ${src}`));
        });
        document.head.appendChild(el);
    });
    cache.set(src, p);
    return p;
}
