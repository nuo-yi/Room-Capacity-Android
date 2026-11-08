export const API_ORIGIN_KEY = "room.api-origin";

export function normalizeApiOrigin(value) {
  if (!value.trim()) return "";
  let url;
  try { url = new URL(value.trim()); } catch {
    throw new Error("Enter a full HTTPS address, such as https://your-site.vercel.app.");
  }
  if (url.protocol !== "https:" || url.username || url.password ||
      url.pathname !== "/" || url.search || url.hash) {
    throw new Error("Use an HTTPS website address without a path, query, or credentials.");
  }
  return url.origin;
}

export function readApiOrigin() {
  try {
    const saved = localStorage.getItem(API_ORIGIN_KEY);
    if (saved !== null) return normalizeApiOrigin(saved);
  } catch { /* The compiled default still works when storage is unavailable. */ }
  return normalizeApiOrigin(import.meta.env?.VITE_API_ORIGIN || "");
}

export function saveApiOrigin(value) {
  const origin = normalizeApiOrigin(value);
  localStorage.setItem(API_ORIGIN_KEY, origin);
  return origin;
}

export function resolveApiUrl(path, origin, native) {
  if (!/^\/api\//.test(path) || path.includes("\\")) {
    throw new Error("Invalid API path.");
  }
  const base = normalizeApiOrigin(origin);
  if (native && !base) {
    throw new Error("Set an API connection to check monitored rooms.");
  }
  return base ? base + path : path;
}
