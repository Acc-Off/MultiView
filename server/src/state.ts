import type { AppConfig } from "./config.js";

/**
 * Singleton that gives the whole app access to the AppConfig finalized at startup.
 * Routes and middleware use it to read admin_token, public_refresh_enabled, and so on.
 */

let config: AppConfig | null = null;

export function setConfig(c: AppConfig): void {
  config = c;
}

export function getConfig(): AppConfig {
  if (!config) {
    throw new Error("AppConfig is not initialized; call setConfig() first.");
  }
  return config;
}
