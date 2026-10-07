import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Hono } from "hono";

import { extractBearer, isAdminToken, refreshGate, requireAdmin } from "../src/middleware/auth.js";
import { setConfig } from "../src/state.js";
import { makeConfig } from "./helpers.js";

const TOKEN = "correct-horse-battery";
const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

describe("extractBearer", () => {
  it("returns the token of a Bearer header", () => {
    assert.equal(extractBearer(`Bearer ${TOKEN}`), TOKEN);
    assert.equal(extractBearer(`bearer   ${TOKEN}  `), TOKEN);
  });

  it("returns null without a usable header", () => {
    assert.equal(extractBearer(undefined), null);
    assert.equal(extractBearer(""), null);
    assert.equal(extractBearer(`Basic ${TOKEN}`), null);
  });
});

describe("isAdminToken", () => {
  it("accepts only the configured token", () => {
    setConfig(makeConfig({ admin_token: TOKEN }));
    assert.equal(isAdminToken(TOKEN), true);
    // Same length, one character off
    assert.equal(isAdminToken("correct-horse-battexy"), false);
    // A different length must not throw (timingSafeEqual requires equal lengths)
    assert.equal(isAdminToken("correct"), false);
    assert.equal(isAdminToken(`${TOKEN}-and-more`), false);
    assert.equal(isAdminToken(null), false);
  });
});

describe("requireAdmin", () => {
  const app = new Hono();
  app.use("/admin/*", requireAdmin);
  app.post("/admin/task", (c) => c.json({ ok: true }));

  it("answers 401 without a token, 403 with a wrong one and lets the right one through", async () => {
    setConfig(makeConfig({ admin_token: TOKEN }));
    assert.equal((await app.request("/admin/task", { method: "POST" })).status, 401);
    assert.equal((await app.request("/admin/task", { method: "POST", headers: bearer("wrong") })).status, 403);
    assert.equal((await app.request("/admin/task", { method: "POST", headers: bearer(TOKEN) })).status, 200);
  });
});

describe("refreshGate", () => {
  const app = new Hono();
  app.use("/refresh", refreshGate);
  app.post("/refresh", (c) => c.json({ ok: true }));

  it("requires the admin token while manual refresh is not public", async () => {
    setConfig(makeConfig({ admin_token: TOKEN, public_refresh_enabled: false }));
    assert.equal((await app.request("/refresh", { method: "POST" })).status, 403);
    assert.equal((await app.request("/refresh", { method: "POST", headers: bearer("wrong") })).status, 403);
    assert.equal((await app.request("/refresh", { method: "POST", headers: bearer(TOKEN) })).status, 200);
  });

  it("lets everyone through once manual refresh is public", async () => {
    setConfig(makeConfig({ admin_token: TOKEN, public_refresh_enabled: true }));
    assert.equal((await app.request("/refresh", { method: "POST" })).status, 200);
  });
});
