import { _android, expect } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";

// Run after installing the debug APK and starting an emulator/ADB server.
// Only selects an emulator unless ANDROID_SERIAL is explicitly supplied.
const devices = await _android.devices();
const device = devices.find((candidate) => process.env.ANDROID_SERIAL
  ? candidate.serial() === process.env.ANDROID_SERIAL
  : candidate.serial().startsWith("emulator-"));
if (!device) throw new Error("Start an Android emulator with the debug APK installed first.");
const pkg = "io.github.grantyu9.roomcapacity";
device.setDefaultTimeout(60000);
let page;
let originalOrigin;
try {
  await device.shell(`am start -n ${pkg}/.MainActivity`);
  const webview = await device.webView({ pkg });
  page = await webview.page();
  page.setDefaultTimeout(30000);
  originalOrigin = await page.evaluate(() => localStorage.getItem("room.api-origin"));
  await page.evaluate(() => localStorage.setItem("room.api-origin", ""));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Find your space." })).toBeVisible();
  expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(true);
  await expect(page.getByText("Live connection not configured · directory available offline")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(68);
  const search = page.getByRole("searchbox", { name: "Search by building or room" });
  await search.fill("sauder");
  await expect(page.getByRole("article").first()).toContainText("ANGU");
  await search.fill("");
  console.log("PASS: native shell, offline directory and search");
  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await device.screenshot({ path: "artifacts/android-home.png" });
  await page.getByRole("article").first().getByRole("button", { name: /^View / }).click();
  await expect(page.getByRole("dialog")).toContainText("Recent occupancy");
  await expect(page.getByRole("dialog")).toContainText("What’s it like right now?");
  await device.screenshot({ path: "artifacts/android-room-details.png" });
  await device.shell("input keyevent KEYCODE_BACK");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  console.log("PASS: directory details, observation form and physical Back button");

  await page.getByRole("button", { name: "API connection", exact: true }).click();
  await page.getByLabel("Website address").fill("https://example.com");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByText("API refresh failed · retrying", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("article")).toHaveCount(68);
  console.log("PASS: invalid API response stays disconnected without sample fallback");

  const nativeHttp = await page.evaluate(async () => {
    const result = await window.Capacitor.Plugins.CapacitorHttp.get({
      url: "https://api.github.com/repos/GrantYu9/Room-Capacity-Website",
      responseType: "json", connectTimeout: 12000, readTimeout: 12000,
    });
    return { status: result.status, name: result.data?.full_name };
  });
  expect(nativeHttp).toEqual({ status: 200, name: "GrantYu9/Room-Capacity-Website" });
  console.log("PASS: real Android HTTP bridge makes an HTTPS JSON request");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await writeFile("artifacts/android-smoke.json", JSON.stringify({
    device: device.model(), serial: device.serial(),
    checkedAt: new Date().toISOString(), nativeHttp,
    checks: ["native shell", "offline directory", "search", "directory details", "observation form", "physical Back", "failed API response", "native HTTPS JSON", "no horizontal overflow"],
  }, null, 2) + "\n");
} finally {
  if (page && originalOrigin !== undefined && !page.isClosed()) {
    await page.evaluate((value) => {
      if (value === null) localStorage.removeItem("room.api-origin");
      else localStorage.setItem("room.api-origin", value);
    }, originalOrigin);
    await page.reload();
  }
  for (const connection of devices) await connection.close();
}
