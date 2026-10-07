import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { closeDb, initDb } from "../src/db.js";
import { Quota, ptDate } from "../src/quota.js";
import { createTempDataDir } from "./helpers.js";

describe("ptDate", () => {
  it("rolls over at midnight Pacific Time, in winter and in summer", () => {
    // Winter: PST is UTC-8
    assert.equal(ptDate(new Date("2026-01-15T07:59:59Z")), "2026-01-14");
    assert.equal(ptDate(new Date("2026-01-15T08:00:00Z")), "2026-01-15");
    // Summer: PDT is UTC-7
    assert.equal(ptDate(new Date("2026-07-15T06:59:59Z")), "2026-07-14");
    assert.equal(ptDate(new Date("2026-07-15T07:00:00Z")), "2026-07-15");
  });
});

describe("Quota", () => {
  let remove: () => void;
  // limit 100 with a 0.95 margin: calls are allowed up to 95 units
  const settings = { youtube_quota_limit: 100, quota_safety_margin: 0.95 };
  const day1 = new Date("2026-03-10T20:00:00Z");
  const day2 = new Date("2026-03-11T20:00:00Z");

  before(() => {
    ({ remove } = createTempDataDir());
    initDb();
  });
  after(() => {
    closeDb();
    remove();
  });

  it("starts a day at zero", () => {
    const state = new Quota(settings).getState(day1);
    assert.equal(state.used, 0);
    assert.equal(state.limit, 100);
    assert.equal(state.exceeded, false);
  });

  it("allows calls right up to the threshold and reports exceeded from there on", () => {
    const quota = new Quota(settings);
    quota.spend(94, day1);
    assert.equal(quota.canSpend(1, day1), true);
    assert.equal(quota.getState(day1).exceeded, false);

    quota.spend(1, day1);
    // 95 of 95: not even a one-unit call fits any more, so the UI must show the paused state
    assert.equal(quota.getState(day1).used, 95);
    assert.equal(quota.canSpend(1, day1), false);
    assert.equal(quota.getState(day1).exceeded, true);
  });

  it("keeps the count across instances, as after a restart", () => {
    assert.equal(new Quota(settings).getState(day1).used, 95);
  });

  it("counts the next Pacific day separately", () => {
    const quota = new Quota(settings);
    assert.equal(quota.getState(day2).used, 0);
    assert.equal(quota.canSpend(1, day2), true);
    assert.equal(quota.getState(day2).exceeded, false);
  });
});
