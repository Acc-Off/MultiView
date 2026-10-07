/// <reference types="vite/client" />

// @rollup/plugin-yaml exposes .yml/.yaml files as a parsed object on the default export.
declare module "*.yml" {
    const value: Record<string, any>;
    export default value;
}
declare module "*.yaml" {
    const value: Record<string, any>;
    export default value;
}
