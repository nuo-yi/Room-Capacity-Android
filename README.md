# room. for Android

An installable Android version of the Room Capacity React website, packaged with Capacitor 8. The frontend snapshot came from `GrantYu9/Room-Capacity-App`; that project and its API/schema are unchanged. This is a WebView interface inside an Android app, not a Kotlin or React Native rewrite.

The app includes the UBC study-space directory and its photos, search and building filters, local favourites, room details, occupancy history, and an explicitly labelled fictional sample preview. The bundled directory and preview work offline. Monitored readings require a reachable deployed API and working sensors; packaging does not connect the physical sensors.

## Install this session's APK

`artifacts/room-capacity-debug.apk` is the locally signed debug build for direct installation. Transfer it to an Android phone, open it, and allow installation from that source when Android asks. Android 7+ and a current Android System WebView are required. This APK is for testing, not Play Store submission.

Production builds default to `https://sensoryatlas.vercel.app`, configured in `.env.production`. The API's `/api/rooms` endpoint was verified to return 69 rooms with a 60-second freshness threshold. Use **API connection** in the app to save a different HTTPS website origin without `/api`. An address already saved on the device overrides the bundled default, including an explicitly saved empty address. To connect an existing installation, save `https://sensoryatlas.vercel.app` there. Saving a connection clears readings from the previous server and retries. It never switches into sample mode automatically. The address is public configuration, not a database connection string or a sensor token.

Alternatively set `VITE_API_ORIGIN` in an ignored `.env.local` before building. An address saved inside the app overrides that build default. Clearing the address disconnects live reads. Native reads use CapacitorHttp, so the existing API CORS allowlist does not need modification; the website continues to use ordinary fetch. API requests time out after 12 seconds. Polling pauses in the background and resumes immediately on return. Android Back dismisses a dialog, returns to the top of the page, then minimizes the app.

## Develop and rebuild

Use Node 22.12+ (this session used Node 24), JDK 21, and Android SDK Platform 36. Install dependencies with `npm ci --include=dev`.

```sh
npm run dev
npm test
npm run build
npm run test:browser
npm run android:build
```

The build script uses `.tools/jdk` and `.tools/android-sdk` when present, or `JAVA_HOME` and `ANDROID_HOME` from your environment. Gradle and Android user caches are kept in `.cache/`. Local tools, APKs, generated assets, signing keys and credentials are ignored by Git. `npm run android:sync` rebuilds and copies the web assets/plugins into the native project; run it after frontend changes. `npm run android:open` opens the project in an installed Android Studio.

Browser tests use system Chromium when available. Otherwise install it with `npx playwright install chromium`. Tests mock API data and need no database credentials. Native transport and back-button/listener behavior also have unit tests; browser mobile emulation does not replace an on-device check.

With an emulator running, start the project-local ADB server, install the APK with `.tools/android-sdk/platform-tools/adb install -r artifacts/room-capacity-debug.apk`, then run `npm run test:android`. The smoke script selects an emulator by default, temporarily changes its API setting, and restores that setting afterward. Set `ANDROID_SERIAL` explicitly to select another device. It writes emulator screenshots and a JSON report under `artifacts/` and uses a public GitHub JSON endpoint to verify the actual native HTTPS transport.

## Verified in this session

- `npm test`: 23 passed.
- `npm run build`: passed.
- `npm run test:browser`: 46 desktop/mobile checks passed, including accessibility, fresh/stale/unknown readings, retry recovery, API setup and native lifecycle simulation.
- `npm run android:build`: passed; the APK signature was verified with Android `apksigner`.
- Android 15 emulator: APK installed and launched; offline directory/search, sample room details/history, physical Back-button dismissal, invalid API response handling and a real native HTTPS JSON request passed. Screenshots are in `artifacts/android-home.png` and `artifacts/android-room-details.png`; the report is `artifacts/android-smoke.json`.

A physical phone and the deployed Room Capacity API/sensors have not been verified. No production API origin was supplied, so live monitored readings still require configuration.

## Distribution

The application ID is `io.github.grantyu9.roomcapacity`. A Play Store release requires a private release signing/upload key, a signed Android App Bundle, store listing/privacy information and a developer account. No release key or store publication is part of this local build. Preserve the debug signing key to update the same installed debug app; uninstalling may clear local favourites and API settings. Android backups are disabled for the app's locally saved settings.

The original font licences are in `LICENSES/`; directory photo attribution and source links are retained in `data/room-images.json` and the UI.
