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
  await expect(page.getByRole("heading", { name: "Find a quieter place to study" })).toBeVisible();
  expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(true);
  await expect(page.getByText("Live connection not configured · directory available offline")).toBeVisible();
  const directory = page.getByRole("region", { name: "Unmonitored study spaces" });
  await expect(directory.getByRole("listitem")).toHaveCount(12);
  await directory.getByRole("searchbox").fill("sauder");
  await expect(directory).toContainText("ANGU");
  await directory.getByRole("searchbox").fill("");
  console.log("PASS: native shell, offline directory and search");

  await mkdir("artifacts", { recursive: true });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await device.screenshot({ path: "artifacts/android-home.png" });
  await page.getByRole("button", { name: "Try sample preview", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(6);
  const firstRoom = page.getByRole("article").first();
  await firstRoom.getByRole("button", { name: /^View / }).click();
  await expect(page.getByRole("dialog")).toContainText("Recent occupancy");
  await expect(page.getByRole("dialog")).toContainText("Fictional");
  await expect(page.getByRole("dialog").getByRole("img", { name: /^People count over time/ })).toBeVisible();
  await device.screenshot({ path: "artifacts/android-room-details.png" });
  await device.shell("input keyevent KEYCODE_BACK");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to monitored rooms" }).click();
  console.log("PASS: sample rooms, occupancy chart and physical Back button");

  await page.getByRole("button", { name: "API connection", exact: true }).click();
  await page.getByLabel("Website address").fill("https://example.com");
  await page.getByRole("button", { name: "Save connection" }).click();
  await expect(page.getByText("API refresh failed · retrying", { exact: true })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole("article")).toHaveCount(0);
  console.log("PASS: invalid API response stays disconnected without sample fallback");

  const nativeHttp = await page.evaluate(async () => {
    const result = await window.Capacitor.Plugins.CapacitorHttp.get({
      url: "https://api.github.com/repos/GrantYu9/Room-Capacity-App",
      responseType: "json", connectTimeout: 12000, readTimeout: 12000,
    });
    return { status: result.status, name: result.data?.full_name };
  });
  expect(nativeHttp).toEqual({ status: 200, name: "GrantYu9/Room-Capacity-App" });
  console.log("PASS: real Android HTTP bridge makes an HTTPS JSON request");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await writeFile("artifacts/android-smoke.json", JSON.stringify({
    device: device.model(), serial: device.serial(),
    checkedAt: new Date().toISOString(), nativeHttp,
    checks: ["native shell", "offline directory", "search", "sample preview", "occupancy history", "physical Back", "failed API response", "native HTTPS JSON", "no horizontal overflow"],
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
