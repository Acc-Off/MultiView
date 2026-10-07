import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { ConfigError, loadConfig } from "../src/config.js";
import { MINIMAL_CONFIG_YAML, createTempDataDir, writeConfigFile } from "./helpers.js";

describe("loadConfig", () => {
  let dir: string;
  let remove: () => void;
  const load = (yaml: string) => loadConfig(writeConfigFile(dir, yaml));

  before(() => {
    ({ dir, remove } = createTempDataDir());
  });
  after(() => remove());

  it("fills in the defaults of a minimal config", () => {
    const config = load(MINIMAL_CONFIG_YAML);
    assert.equal(config.polling_enabled, true);
    assert.equal(config.poll_interval_live_youtube_minutes, 3);
    assert.equal(config.poll_interval_live_twitch_minutes, 1);
    assert.equal(config.poll_interval_archive_minutes, 15);
    assert.equal(config.public_refresh_enabled, false);
    assert.equal(config.youtube_quota_limit, 10000);
    assert.equal(config.quota_safety_margin, 0.95);
    assert.equal(config.site_name, "");
    assert.deepEqual(config.site_links, []);
    assert.deepEqual(config.channels, { youtube: [], twitch: [] });
  });

  it("names the missing required key", () => {
    const yaml = MINIMAL_CONFIG_YAML.replace(/^admin_token:.*$/m, "");
    assert.throws(() => load(yaml), (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /"admin_token"/);
      return true;
    });
  });

  it("ignores keys it does not know, such as the removed site_domain", () => {
    const config = load(`site_domain: "example.com"\n${MINIMAL_CONFIG_YAML}`);
    assert.equal("site_domain" in config, false);
  });

  it("lowercases Twitch logins and leaves YouTube channel IDs alone", () => {
    const config = load(`${MINIMAL_CONFIG_YAML}
channels:
  youtube:
    - { id: "UCAbCdEfGhIjKlMnOpQrStUv", name: "yt", live: true, video: false }
  twitch:
    - { id: "Mixed_Case_Login", name: "tw" }
`);
    assert.equal(config.channels.twitch[0].id, "mixed_case_login");
    assert.equal(config.channels.youtube[0].id, "UCAbCdEfGhIjKlMnOpQrStUv");
  });

  it("requires both live and video on a YouTube channel", () => {
    const yaml = `${MINIMAL_CONFIG_YAML}
channels:
  youtube:
    - { id: "UCxxxxxxxxxxxxxxxxxxxxxx", name: "yt", live: true }
`;
    assert.throws(() => load(yaml), (err: unknown) => {
      assert.ok(err instanceof ConfigError);
      assert.match(err.message, /channels\.youtube\[0\]\.video/);
      return true;
    });
  });

  for (const key of [
    "poll_interval_live_youtube_minutes",
    "poll_interval_live_twitch_minutes",
    "poll_interval_archive_minutes",
  ]) {
    for (const value of [0, -5]) {
      it(`rejects ${key}: ${value}`, () => {
        assert.throws(() => load(`${key}: ${value}\n${MINIMAL_CONFIG_YAML}`), (err: unknown) => {
          assert.ok(err instanceof ConfigError);
          assert.match(err.message, new RegExp(`"${key}" must be greater than 0`));
          return true;
        });
      });
    }
  }
});
