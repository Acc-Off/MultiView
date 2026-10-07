import assert from "node:assert/strict";
import { after, afterEach, before, describe, it, mock } from "node:test";

import { closeDb, initDb } from "../src/db.js";
import { getQuota, initQuota } from "../src/quota.js";
import { getChannelsByPlatform, syncChannels } from "../src/services/channels.js";
import { QuotaExceededError, YouTubeHttpError, fetchYouTube } from "../src/services/youtube.js";
import { setConfig } from "../src/state.js";
import { createTempDataDir, jsonResponse, makeConfig, stubFetch } from "./helpers.js";

// Three channels. B stands for a channel whose uploads playlist cannot be found: it has no public
// videos yet, its ID is wrong, or it is gone.
const A = "UCaaaaaaaaaaaaaaaaaaaaaa";
const B = "UCbbbbbbbbbbbbbbbbbbbbbb";
const C = "UCcccccccccccccccccccccc";
const uploads = (channelId: string) => "UU" + channelId.slice(2);

const PLAYLISTS: Record<string, string[]> = {
  [uploads(A)]: ["liveA", "pastA"],
  [uploads(C)]: ["upcomingC"],
};
const VIDEOS: Record<string, object> = {
  liveA: {
    id: "liveA",
    snippet: { title: "Live now", channelId: A, publishedAt: "2026-01-01T00:00:00Z", liveBroadcastContent: "live" },
    liveStreamingDetails: { actualStartTime: "2026-01-01T00:05:00Z" },
    status: { uploadStatus: "uploaded" },
  },
  pastA: {
    id: "pastA",
    snippet: { title: "Yesterday", channelId: A, publishedAt: "2025-12-31T00:00:00Z", liveBroadcastContent: "none" },
    status: { uploadStatus: "processed" },
    contentDetails: { duration: "PT1H2M3S" },
  },
  upcomingC: {
    id: "upcomingC",
    snippet: { title: "Tomorrow", channelId: C, publishedAt: "2026-01-01T00:00:00Z", liveBroadcastContent: "upcoming" },
    liveStreamingDetails: { scheduledStartTime: "2026-01-02T00:00:00Z" },
    status: { uploadStatus: "uploaded" },
  },
};

/** A stand-in for the YouTube Data API. missingStatus is what channel B's playlist request gets. */
function youtubeApi(missingStatus: number) {
  return (url: URL): Response => {
    if (url.pathname.endsWith("/playlistItems")) {
      const ids = PLAYLISTS[url.searchParams.get("playlistId") ?? ""];
      if (!ids) return jsonResponse({ error: { message: "The playlist cannot be found." } }, missingStatus);
      return jsonResponse({ items: ids.map((videoId) => ({ contentDetails: { videoId } })) });
    }
    if (url.pathname.endsWith("/videos")) {
      const ids = (url.searchParams.get("id") ?? "").split(",");
      return jsonResponse({ items: ids.map((id) => VIDEOS[id]) });
    }
    return jsonResponse({ error: { message: `unexpected request: ${url.pathname}` } }, 500);
  };
}

describe("fetchYouTube", () => {
  let remove: () => void;
  const channels = () => getChannelsByPlatform("youtube");

  before(() => {
    ({ remove } = createTempDataDir());
    const config = makeConfig({
      youtube_quota_limit: 1000,
      channels: {
        youtube: [A, B, C].map((id) => ({ id, name: id, live: true, video: true })),
        twitch: [],
      },
    });
    initDb();
    setConfig(config);
    initQuota(config);
    syncChannels(config);
  });
  afterEach(() => mock.restoreAll());
  after(() => {
    closeDb();
    remove();
  });

  it("skips a channel whose uploads playlist is missing and still returns the others", async () => {
    const warn = mock.method(console, "warn", () => {});
    stubFetch(youtubeApi(404));

    const first = await fetchYouTube(channels());
    assert.deepEqual(first.live.map((v) => [v.id, v.status]), [["liveA", "live"], ["upcomingC", "upcoming"]]);
    assert.deepEqual(first.archive.map((v) => v.id), ["pastA"]);
    assert.equal(first.archive[0].duration, 3723);
    assert.equal(first.live[0].channel.platform, "youtube");

    // The skipped channel is reported once, not on every polling cycle.
    await fetchYouTube(channels());
    const reports = warn.mock.calls.filter((call) => String(call.arguments[0]).includes(B));
    assert.equal(reports.length, 1);
  });

  it("charges one unit per request, including the one that failed", async () => {
    stubFetch(youtubeApi(404));
    const before = getQuota().getState().used;
    await fetchYouTube(channels());
    // Three playlist requests (one of them the 404) and one videos request
    assert.equal(getQuota().getState().used - before, 4);
  });

  it("fails the whole cycle on any other error", async () => {
    stubFetch(youtubeApi(403));
    await assert.rejects(fetchYouTube(channels()), (err: unknown) => {
      assert.ok(err instanceof YouTubeHttpError);
      assert.equal(err.status, 403);
      return true;
    });
  });

  it("stops calling the API once the quota threshold is reached", async () => {
    const quota = getQuota();
    // Spend what is left: the threshold is 950 of 1000 units
    quota.spend(950 - quota.getState().used);
    const requested = stubFetch(youtubeApi(404));

    await assert.rejects(fetchYouTube(channels()), QuotaExceededError);
    assert.equal(requested.length, 0);
    assert.equal(quota.getState().exceeded, true);
  });
});
