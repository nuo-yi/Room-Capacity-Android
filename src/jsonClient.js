import { resolveApiUrl } from "./apiConfig.js";

// Native reads and reports use Android HTTP and its cookie manager.
// Reporter cookies stay in the native jar; no sensor token is used.
export function createJsonClient({ isNative, readOrigin, nativeGet, nativePost, fetchImpl, timeoutMs = 12000 }) {
  return async function fetchJson(path, { signal, method = "GET", headers, body } = {}) {
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
          const options = { url, responseType: "json", connectTimeout: timeoutMs, readTimeout: timeoutMs };
          if (headers) options.headers = headers;
          if (body !== undefined) options.data = typeof body === "string" ? JSON.parse(body) : body;
          const send = method === "POST" ? nativePost : nativeGet;
          if (!["GET", "POST"].includes(method) || !send) throw new Error("Unsupported request method.");
          const response = await send(options);
          let data;
          try { data = typeof response.data === "string" ? JSON.parse(response.data) : response.data; }
          catch { throw new Error("Unexpected server response."); }
          if (response.status < 200 || response.status >= 300) throw new Error(data?.error || "Request failed.");
          return data;
        }
        const response = await fetchImpl(url, { signal: controller.signal, method, headers, body, credentials: "include" });
        let data;
        try { data = await response.json(); } catch { throw new Error("Unexpected server response."); }
        if (!response.ok) throw new Error(data?.error || "Request failed.");
        return data;
      })();
      return await Promise.race([request, cancelled]);
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", cancel);
    }
  };
}
