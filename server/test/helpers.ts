import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mock } from "node:test";

import type { AppConfig } from "../src/config.js";

/**
 * Shared helpers for the tests.
 *
 * The tests never talk to YouTube or Twitch: the global fetch is replaced with a stub, so no API
 * credentials are needed. Each test file runs in its own process (the node:test default), which
 * keeps the module-level singletons (database, config, quota) from leaking between files.
 */

/** Creates a scratch directory and points DB_PATH into it, so the database and icons land there. */
export function createTempDataDir(): { dir: string; remove: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "multiview-test-"));
  process.env.DB_PATH = join(dir, "multiview.db");
  return {
    dir,
    // Close the database before calling this; Windows cannot delete an open file.
    remove: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/** Writes a YAML document into dir and returns the file's path, for loadConfig(). */
export function writeConfigFile(dir: string, yaml: string): string {
  const file = join(dir, `config-${Math.random().toString(36).slice(2)}.yaml`);
  writeFileSync(file, yaml);
  return file;
}

/** The smallest config.yaml the server accepts. */
export const MINIMAL_CONFIG_YAML = `
youtube_api_key: "test-youtube-key"
twitch_client_id: "test-twitch-id"
twitch_client_secret: "test-twitch-secret"
admin_token: "correct-horse-battery"
`;

/** An AppConfig for tests that set the config directly instead of loading a file. */
export function makeConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    site_name: "",
    site_links: [],
    youtube_api_key: "test-youtube-key",
    twitch_client_id: "test-twitch-id",
    twitch_client_secret: "test-twitch-secret",
    admin_token: "correct-horse-battery",
    polling_enabled: false,
    poll_interval_live_youtube_minutes: 3,
    poll_interval_live_twitch_minutes: 1,
    poll_interval_archive_minutes: 15,
    public_refresh_enabled: false,
    youtube_quota_limit: 100,
    quota_safety_margin: 0.95,
    channels: { youtube: [], twitch: [] },
    ...overrides,
  };
}

/** A JSON response, the way the YouTube and Twitch APIs answer. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/**
 * Replaces the global fetch with handler and returns the list of URLs requested so far.
 * Undo it with mock.restoreAll() (see the afterEach hooks in the test files).
 */
export function stubFetch(handler: (url: URL) => Response | Promise<Response>): URL[] {
  const requested: URL[] = [];
  mock.method(globalThis, "fetch", async (input: string | URL | Request): Promise<Response> => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    requested.push(url);
    return handler(url);
  });
  return requested;
}
