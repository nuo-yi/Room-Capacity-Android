import { test, expect } from "@playwright/test";

test("background polling pauses and resume immediately refreshes without duplicate loops", async ({ page }) => {
  let calls = 0;
  await page.clock.install();
  await page.route("**/api/rooms*", (route) => { calls++; return route.fulfill({ json: { rooms: [], stale_after_seconds: 60 } }); });
  await page.goto("/");
  await expect(page.getByText("API reachable · checks every ~10s", { exact: true })).toBeVisible();
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("room:app-state", { detail: { isActive: false } })));
  const paused = calls;
  await page.clock.fastForward(30000);
  expect(calls).toBe(paused);
  await page.evaluate(() => document.dispatchEvent(new CustomEvent("room:app-state", { detail: { isActive: true } })));
  await expect.poll(() => calls).toBe(paused + 1);
  await page.clock.fastForward(10000);
  await expect.poll(() => calls).toBe(paused + 2);
});


async function mockNativeBridge(page) {
  await page.addInitScript(() => {
    window.CapacitorCustomPlatform = { name: "android" };
    window.nativeListeners = {};
    window.nativeRequests = [];
    window.nativeMinimized = false;
    window.nativeOffline = false;
    window.Capacitor = {
      PluginHeaders: [
        { name: "CapacitorHttp", methods: [{ name: "get", rtype: "promise" }, { name: "post", rtype: "promise" }] },
        { name: "App", methods: [{ name: "addListener", rtype: "callback" }, { name: "removeListener", rtype: "promise" }, { name: "minimizeApp", rtype: "promise" }] },
      ],
      nativeCallback(_plugin, method, options, callback) {
        if (method === "addListener") window.nativeListeners[options.eventName] = callback;
        return "test-callback";
      },
      async nativePromise(plugin, method, options) {
        if (plugin === "App") {
          if (method === "minimizeApp") window.nativeMinimized = true;
          return {};
        }
        window.nativeRequests.push(options.url);
        if (method === "post") {
          window.submittedReport = options.data;
          return { status: 201, data: { saved: true, message: "Thanks! Your observation was received." } };
        }
        if (window.nativeOffline) return { status: 503, data: {} };
        const reading = { people_count: 0, noise_level: 0.1, noise_unit: "relative", measured_at: new Date().toISOString() };
        return { status: 200, data: options.url.includes("/api/readings")
          ? { readings: [reading] }
          : { rooms: [{ room_id: "android-fixture", name: "Android Room", total_capacity: 10, location: { building: "Test Building" }, latest_reading: reading }], stale_after_seconds: 60 } };
      },
    };
  });
}

test("Android setup persists, native reads load rooms/history, and Back closes dialogs", async ({ page }) => {
  await mockNativeBridge(page);
  await page.goto("/");
  await expect(page.getByText("Live connection not configured · directory available offline")).toBeVisible();
  await expect(page.getByRole("region", { name: "Find your space." })).toBeVisible();
  await page.getByRole("button", { name: "API connection", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "API connection" });
  await dialog.getByLabel("Website address").fill("https://example.com/api");
  await dialog.getByRole("button", { name: "Save connection" }).click();
  await expect(dialog.getByRole("alert")).toContainText("without a path");
  await dialog.getByLabel("Website address").fill("https://example.com");
  await dialog.getByRole("button", { name: "Save connection" }).click();
  const room = page.getByRole("article").filter({ hasText: "Android Room" });
  await expect(room).toContainText("10");
  await room.getByRole("button", { name: "View Android Room" }).click();
  await expect(page.getByRole("dialog")).toContainText("Recent occupancy");
  await expect.poll(() => page.evaluate(() => window.nativeRequests.some((url) => url.includes("/api/readings?room_id=android-fixture&limit=100")))).toBe(true);
  await page.evaluate(() => window.nativeListeners.backButton({}));
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("article").filter({ hasText: "Android Room" })).toBeVisible();
  await page.getByRole("button", { name: "API connection", exact: true }).click();
  await expect(page.getByLabel("Website address")).toHaveValue("https://example.com");
  await page.getByLabel("Website address").fill("");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByRole("article")).toHaveCount(68);
  await expect(page.getByText("Live connection not configured · directory available offline")).toBeVisible();
});

test("Android native failed checks recover on resume and never select sample mode", async ({ page }) => {
  await mockNativeBridge(page);
  await page.addInitScript(() => { localStorage.setItem("room.api-origin", "https://example.com"); window.nativeOffline = true; });
  await page.goto("/");
  await expect(page.getByText("API refresh failed · retrying", { exact: true })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(68);
  await page.evaluate(() => {
    window.nativeListeners.appStateChange({ isActive: false });
    window.nativeOffline = false;
    window.nativeListeners.appStateChange({ isActive: true });
  });
  await expect(page.getByRole("article").filter({ hasText: "Android Room" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try sample preview", exact: true })).toHaveCount(0);
  await page.evaluate(() => { window.scrollTo(0, 0); window.nativeListeners.backButton({}); });
  await expect.poll(() => page.evaluate(() => window.nativeMinimized)).toBe(true);
});


test("Android submits observations through the native bridge and refreshes rooms", async ({ page }) => {
  await mockNativeBridge(page);
  await page.addInitScript(() => localStorage.setItem("room.api-origin", "https://example.com"));
  await page.goto("/");
  await page.getByRole("button", { name: "View Android Room", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("group", { name: "Approximate fullness (%)", exact: true }).getByRole("button", { name: "0%", exact: true }).click();
  await dialog.getByRole("group", { name: "Noise level", exact: true }).getByRole("button", { name: "Quiet", exact: true }).click();
  const checks = await page.evaluate(() => window.nativeRequests.filter(url => url.endsWith("/api/rooms")).length);
  await dialog.getByRole("button", { name: "Share observation", exact: true }).click();
  await expect(dialog.getByRole("status")).toContainText("Thanks!");
  expect(await page.evaluate(() => window.submittedReport)).toEqual({ room_id: "android-fixture", occupancy_percent: 0, noise_band: "quiet" });
  await expect.poll(() => page.evaluate(() => window.nativeRequests.filter(url => url.endsWith("/api/rooms")).length)).toBeGreaterThan(checks);
  await page.evaluate(() => window.nativeListeners.backButton({}));
  await expect(dialog).toHaveCount(0);
});
