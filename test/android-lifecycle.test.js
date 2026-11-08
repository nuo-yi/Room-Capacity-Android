import test from "node:test";
import assert from "node:assert/strict";
import { handleAndroidBack, startNativeRuntime } from "../src/nativeRuntime.js";

test("Android back closes the top dialog before scrolling or minimizing", () => {
  let cancelled = false;
  handleAndroidBack({ querySelectorAll: () => [{ dispatchEvent(event) { cancelled = event.type === "cancel" && event.cancelable; } }] }, { scrollY: 500, scrollTo() { assert.fail("Dialog should close first"); } }, () => assert.fail("Dialog should close first"));
  assert.equal(cancelled, true);
  let scrolled = false;
  handleAndroidBack({ querySelectorAll: () => [] }, { scrollY: 500, scrollTo() { scrolled = true; } }, () => assert.fail("Should scroll first"));
  assert.equal(scrolled, true);
  let minimized = false;
  handleAndroidBack({ querySelectorAll: () => [] }, { scrollY: 0 }, () => { minimized = true; });
  assert.equal(minimized, true);
});

test("native listeners are removed even if setup resolves after unmount", async () => {
  let removed = 0;
  const cleanup = startNativeRuntime(() => {}, { native: true, app: { addListener: async () => ({ remove() { removed++; } }) }, doc: {}, win: {} });
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(removed, 2);
});
