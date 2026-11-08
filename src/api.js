import { Capacitor, CapacitorHttp } from "@capacitor/core";
import { readApiOrigin } from "./apiConfig.js";
import { createJsonClient } from "./jsonClient.js";

export const fetchJson = createJsonClient({
  isNative: () => Capacitor.isNativePlatform(),
  readOrigin: readApiOrigin,
  nativePost: (options) => CapacitorHttp.post(options),
  nativeGet: (options) => CapacitorHttp.get(options),
  fetchImpl: (...args) => fetch(...args),
});
