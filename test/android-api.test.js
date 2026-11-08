import test from "node:test";
import assert from "node:assert/strict";
import { normalizeApiOrigin, resolveApiUrl } from "../src/apiConfig.js";
import { createJsonClient } from "../src/jsonClient.js";

test("API configuration accepts HTTPS origins and rejects credentials, paths and insecure URLs", () => {
  assert.equal(normalizeApiOrigin(" https://example.com/ "), "https://example.com");
  assert.equal(normalizeApiOrigin(""), "");
  for (const value of ["http://example.com", "https://user:password@example.com", "https://example.com/api", "https://example.com?key=private", "https://example.com/#x", "javascript:alert(1)"]) {
    assert.throws(() => normalizeApiOrigin(value));
  }
  assert.equal(resolveApiUrl("/api/rooms", "", false), "/api/rooms");
  assert.equal(resolveApiUrl("/api/readings?room_id=a&limit=100", "https://example.com", true), "https://example.com/api/readings?room_id=a&limit=100");
  assert.throws(() => resolveApiUrl("/api/rooms", "", true), /Set an API connection/);
  assert.throws(() => resolveApiUrl("https://other.example/api/rooms", "https://example.com", true));
});

function client(overrides = {}) {
  return createJsonClient({ isNative: () => true, readOrigin: () => "https://example.com", nativeGet: async () => ({ status: 200, data: { rooms: [] } }), fetchImpl: () => { throw new Error("Web fetch must not run for native requests"); }, ...overrides });
}

test("Android reads aggregate data with the native HTTP bridge and no device credentials", async () => {
  let options;
  const read = client({ nativeGet: async (value) => { options = value; return { status: 200, data: '{"rooms":[]}' }; } });
  assert.deepEqual(await read("/api/rooms"), { rooms: [] });
  assert.deepEqual(options, { url: "https://example.com/api/rooms", responseType: "json", connectTimeout: 12000, readTimeout: 12000 });
});

test("native timeout and cancellation ignore unfinished requests", async () => {
  const read = client({ nativeGet: () => new Promise(() => {}), timeoutMs: 15 });
  await assert.rejects(read("/api/rooms"), { name: "TimeoutError" });
  const controller = new AbortController();
  const pending = client({ nativeGet: () => new Promise(() => {}) })("/api/rooms", { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  await assert.rejects(client()("/api/rooms", { signal: controller.signal }), { name: "AbortError" });
});

test("failed native requests recover on retry without returning sample data", async () => {
  let attempts = 0;
  const read = client({ nativeGet: async () => ++attempts === 1 ? { status: 503, data: {} } : { status: 200, data: { rooms: [] } } });
  await assert.rejects(read("/api/rooms"), /Request failed/);
  assert.deepEqual(await read("/api/rooms"), { rooms: [] });
});

test("browser requests keep same-origin API behavior", async () => {
  let requested;
  const read = client({ isNative: () => false, readOrigin: () => "", fetchImpl: async (url) => { requested = url; return { ok: true, json: async () => ({ rooms: [] }) }; } });
  assert.deepEqual(await read("/api/rooms"), { rooms: [] });
  assert.equal(requested, "/api/rooms");
});
