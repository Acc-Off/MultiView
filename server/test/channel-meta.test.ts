import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { after, afterEach, before, beforeEach, describe, it, mock } from "node:test";

import { loadConfig } from "../src/config.js";
import { closeDb, getDb, initDb } from "../src/db.js";
import { initQuota } from "../src/quota.js";
import { getAllChannels, syncChannels } from "../src/services/channels.js";
import { fillMissingThumbnails } from "../src/services/fetchers.js";
import { setConfig } from "../src/state.js";
import { MINIMAL_CONFIG_YAML, createTempDataDir, jsonResponse, stubFetch, writeConfigFile } from "./helpers.js";

const YOUTUBE_ID = "UCaaaaaaaaaaaaaaaaaaaaaa";
// Written in mixed case on purpose: Twitch always answers with the lowercase login.
const TWITCH_ID_AS_CONFIGURED = "Mixed_Case_Login";
const TWITCH_LOGIN = "mixed_case_login";

const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]);

/** Stand-ins for the YouTube and Twitch APIs and the image hosts. Each side can be made to fail. */
function apis({ youtubeFails = false, twitchFails = false }) {
  return (url: URL): Response => {
    if (url.hostname === "www.googleapis.com") {
      if (youtubeFails) return jsonResponse({ error: { message: "API key not valid" } }, 400);
      return jsonResponse({
        items: [{
          id: YOUTUBE_ID,
          snippet: {
            title: "Real YouTube name",
            customUrl: "@realhandle",
            thumbnails: { medium: { url: "https://img.example/youtube.png" } },
          },
        }],
      });
    }
    if (url.hostname === "id.twitch.tv") return jsonResponse({ access_token: "token", expires_in: 3600 });
    if (url.hostname === "api.twitch.tv") {
      if (twitchFails) return jsonResponse({ message: "boom" }, 500);
      return jsonResponse({
        data: url.searchParams.getAll("login").map((login) => ({
          login,
          display_name: "Real Twitch name",
          profile_image_url: "https://img.example/twitch.png",
        })),
      });
    }
    if (url.hostname === "img.example") return new Response(PNG, { headers: { "content-type": "image/png" } });
    return jsonResponse({ error: `unexpected request: ${url.href}` }, 500);
  };
}

describe("fillMissingThumbnails", () => {
  let dir: string;
  let remove: () => void;
  const channel = (platform: string) => getAllChannels().find((c) => c.platform === platform)!;

  before(() => {
    ({ dir, remove } = createTempDataDir());
    const config = loadConfig(writeConfigFile(dir, `${MINIMAL_CONFIG_YAML}
channels:
  youtube:
    - { id: "${YOUTUBE_ID}", name: "note for the YouTube channel", live: true, video: true }
  twitch:
    - { id: "${TWITCH_ID_AS_CONFIGURED}", name: "note for the Twitch channel" }
`));
    initDb();
    setConfig(config);
    initQuota(config);
    syncChannels(config);
  });
  beforeEach(() => {
    // Every test starts with no names or icons fetched yet.
    getDb().prepare("UPDATE channels SET thumbnail = NULL, display_name = NULL, handle = NULL").run();
  });
  afterEach(() => mock.restoreAll());
  after(() => {
    closeDb();
    remove();
  });

  it("stores the real names and downloads the icons of both platforms", async () => {
    stubFetch(apis({}));
    await fillMissingThumbnails();

    const youtube = channel("youtube");
    assert.equal(youtube.display_name, "Real YouTube name");
    assert.equal(youtube.handle, "realhandle");
    assert.match(youtube.thumbnail ?? "", new RegExp(`^/thumbnails/${YOUTUBE_ID}\\.[0-9a-f]{8}\\.png$`));

    // The Twitch row is found although config.yaml spelled the login in mixed case.
    const twitch = channel("twitch");
    assert.equal(twitch.id, TWITCH_LOGIN);
    assert.equal(twitch.display_name, "Real Twitch name");
    assert.match(twitch.thumbnail ?? "", new RegExp(`^/thumbnails/${TWITCH_LOGIN}\\.[0-9a-f]{8}\\.png$`));

    // The icons are files next to the database, served by the app itself.
    assert.ok(existsSync(join(dir, twitch.thumbnail!)));
    // The note from config.yaml is kept as it is.
    assert.equal(twitch.name, "note for the Twitch channel");
  });

  it("still handles Twitch when YouTube fails, and reports the failure", async () => {
    stubFetch(apis({ youtubeFails: true }));
    await assert.rejects(fillMissingThumbnails(), /YouTube channels failed: 400 API key not valid/);

    assert.equal(channel("youtube").thumbnail, null);
    assert.equal(channel("twitch").display_name, "Real Twitch name");
    assert.notEqual(channel("twitch").thumbnail, null);
  });

  it("still handles YouTube when Twitch fails, and reports the failure", async () => {
    stubFetch(apis({ twitchFails: true }));
    await assert.rejects(fillMissingThumbnails(), /Twitch users failed: 500/);

    assert.equal(channel("twitch").thumbnail, null);
    assert.equal(channel("youtube").display_name, "Real YouTube name");
    assert.notEqual(channel("youtube").thumbnail, null);
  });

  it("makes no request when nothing is missing", async () => {
    // Fetch everything once, then run it again and count the requests.
    stubFetch(apis({}));
    await fillMissingThumbnails();
    mock.restoreAll();

    const requested = stubFetch(apis({}));
    await fillMissingThumbnails();
    assert.equal(requested.length, 0);
  });
});
