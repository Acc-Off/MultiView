/* eslint-disable import/no-extraneous-dependencies,prefer-regex-literals */
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath } from "url";
import vue from "@vitejs/plugin-vue";
import Components from "unplugin-vue-components/vite";
import { Vuetify3Resolver } from "unplugin-vue-components/resolvers";
import { visualizer } from "rollup-plugin-visualizer";
import yaml from "@rollup/plugin-yaml";
import path from "path";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Bypass vite stuff and just load .env into process.env
dotenv.config();

/**
 * @param {{ mode: string, command: string }}
 */
export default ({ mode }) => {
    const env = { ...process.env, ...loadEnv(mode, process.cwd()) };
    // MultiView's own backend (default: the port the local server/ listens on)
    const API_BASE_URL = env.API_BASE_URL ?? "http://localhost:3000";
    const REWRITE_API_ROUTES = !!env.REWRITE_API_ROUTES;
    return defineConfig({
        plugins: [
            yaml(),
            vue(),
            Components({
                resolvers: [Vuetify3Resolver()],
                deep: false,
                dirs: [],
                /**
                 * unplugin-vue-components removes the need to import components by deepscanning the
                 * src/components folder, but is fairly dangerous in terms of how it figures out which
                 * to import. Since we use manual imports, we only want it for Vuetify resolution
                 * (dirs: [] disables the directory auto-scan).
                 */
            }),
            visualizer({ gzipSize: true }),
        ],
        resolve: {
            alias: [
                {
                    find: "@",
                    replacement: path.resolve(__dirname, "src"),
                },
            ],
        },
        build: {
            sourcemap: true,
            target: "es2020",
            rollupOptions: {
                input: {
                    main: path.resolve(__dirname, "index.html"),
                },
                // compact/generatedCode were removed: Rolldown in Vite 8 does not support these keys (it emits modern, minified output by default)
            },
        },
        server: {
            port: 8080,
            proxy: {
                "/api": {
                    target: API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                    ws: true,
                    rewrite: (url) => (REWRITE_API_ROUTES ? url.replace(/^\/api/, "") : url),
                },
                // Channel icons are files served by the backend, outside /api.
                "/thumbnails": {
                    target: API_BASE_URL,
                    changeOrigin: true,
                    secure: false,
                },
            },
        },
    });
};
