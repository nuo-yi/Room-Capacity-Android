import { resolveApiUrl } from "./apiConfig.js";

// Native requests use Android's HTTP client, so the server's web-origin
// allowlist and API/schema do not need to change. No device token is used.
export function createJsonClient({ isNative, readOrigin, nativeGet, fetchImpl, timeoutMs = 12000 }) {
  return async function fetchJson(path, { signal } = {}) {
    const native = isNative();
    const url = resolveApiUrl(path, readOrigin(), native);
    const controller = new AbortController();
    let rejectCancelled;
    const cancelled = new Promise((_, reject) => { rejectCancelled = reject; });
    const cancel = () => {
      controller.abort();
      rejectCancelled(signal?.reason || new DOMException("Request cancelled.", "AbortError"));
    };
    if (signal?.aborted) throw signal.reason || new DOMException("Request cancelled.", "AbortError");
    signal?.addEventListener("abort", cancel, { once: true });
    const timeout = setTimeout(() => {
      controller.abort();
      rejectCancelled(new DOMException("Request timed out.", "TimeoutError"));
    }, timeoutMs);
    try {
      const request = (async () => {
        if (native) {
          const response = await nativeGet({ url, responseType: "json", connectTimeout: timeoutMs, readTimeout: timeoutMs });
          if (response.status < 200 || response.status >= 300) throw new Error("Request failed.");
          return typeof response.data === "string" ? JSON.parse(response.data) : response.data;
        }
        const response = await fetchImpl(url, { signal: controller.signal });
        if (!response.ok) throw new Error("Request failed.");
        return response.json();
      })();
      return await Promise.race([request, cancelled]);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  };
}
