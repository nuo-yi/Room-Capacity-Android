import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export function handleAndroidBack(doc, win, minimize) {
  const dialog = [...doc.querySelectorAll("dialog[open]")].at(-1);
  if (dialog) {
    dialog.dispatchEvent(new Event("cancel", { cancelable: true }));
  } else if (win.scrollY > 80) {
    win.scrollTo({ top: 0, behavior: "instant" });
  } else {
    minimize();
  }
}

export function startNativeRuntime(onResume, { native = Capacitor.isNativePlatform(), app = App, doc = document, win = window } = {}) {
  if (!native) return () => {};
  let disposed = false;
  const handles = [];
  const listen = (event, listener) => {
    Promise.resolve(app.addListener(event, listener)).then((handle) => {
      if (disposed) handle.remove();
      else handles.push(handle);
    }).catch(() => { /* A missing optional lifecycle plugin must not break browsing. */ });
  };
  listen("appStateChange", ({ isActive }) => {
    doc.dispatchEvent(new CustomEvent("room:app-state", { detail: { isActive } }));
    if (isActive) onResume();
  });
  listen("backButton", () => handleAndroidBack(doc, win, () => app.minimizeApp()));
  return () => {
    disposed = true;
    handles.forEach((handle) => handle.remove());
  };
}
