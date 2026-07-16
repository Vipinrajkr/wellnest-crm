# Wellnest — Android Build & Release

This project's `android/` folder was hand-scaffolded to match what `npx cap add android` normally generates, since the environment that authored these files has no Node/npm, JDK, Android SDK, or Gradle available to actually run Capacitor's CLI or compile anything. **Everything below must be run on your own machine** (Windows, with Android Studio installed) before you have a real, launchable app or a signed release build.

## 1. One-time setup

1. Install [Node.js](https://nodejs.org) (LTS) and [Android Studio](https://developer.android.com/studio) (which bundles the Android SDK).
2. From the project root (`wellnest-crm/`):
   ```
   npm install
   ```
3. Let Capacitor fill in the generated files this hand-authored scaffold intentionally left out (`android/app/capacitor.build.gradle`, `android/capacitor.settings.gradle`, `android/capacitor-cordova-android-plugins/`, the Gradle wrapper `gradlew`/`gradlew.bat`/`gradle-wrapper.jar`, and a copy of `src/` into `android/app/src/main/assets/public/`):
   ```
   npx cap sync android
   ```
   If `npx cap sync` complains the `android/` platform isn't recognized (can happen since it wasn't created by `cap add`), run `npx cap add android` first — Capacitor will detect the existing folder, fill in only what's missing, and leave the hand-authored `AndroidManifest.xml`, gradle files, icons, and splash screen alone. If it instead tries to overwrite them, restore from git and re-apply — those files are the ones actually reviewed for this app (permissions, WorkManager wiring, branding) and shouldn't be regenerated from Capacitor's bare defaults.
4. Open `android/` in Android Studio once (`npm run open:android`) so it can finish indexing/downloading Gradle + the Android SDK platform (API 34) and build tools if you don't already have them.

## 2. Every time `src/` changes

```
npx cap sync android
```

This re-copies `src/` into the native project's assets. No other step is needed for JS/HTML/CSS-only changes — there's no bundler/build step (see `PROJECT_SPEC.md` §3), so `cap sync` is literally a file copy plus a plugin-registration refresh.

## 3. Debug build (sideload for testing)

```
npm run build:debug
```

Produces `android/app/build/outputs/apk/debug/app-debug.apk`, signed with Android's shared debug key — installable on a test device via `adb install` or by copying the APK over, but **not** suitable for distribution.

## 4. Release signing (one-time, per signing identity)

Generate a release keystore locally — **do not** use the debug keystore for a release build, and never commit the keystore or its passwords:

```
keytool -genkeypair -v -keystore wellnest-release.keystore -alias wellnest -keyalg RSA -keysize 2048 -validity 10000
```

Answer the prompts (name/org/etc. — cosmetic, not user-facing) and choose strong passwords. Store the resulting `wellnest-release.keystore` file somewhere safe outside the repo (a password manager's attachment, an encrypted drive) — losing it means you can never publish an update to an already-installed app under the same signature.

Create `android/keystore.properties` (already gitignored — see `.gitignore`) next to `android/build.gradle`:

```properties
storeFile=/absolute/path/to/wellnest-release.keystore
storePassword=<your store password>
keyAlias=wellnest
keyPassword=<your key password>
```

`android/app/build.gradle` already reads this file for the `release` signing config (falls back to unsigned if the file is absent, so a fresh checkout without it can still build debug).

## 5. Release build

```
npm run build:release
```
→ `android/app/build/outputs/apk/release/app-release.apk` (signed, ready to sideload)

Or, for Play Store submission (Android App Bundle instead of a flat APK — also the smaller download for a given device, since Play generates a device-specific APK from it rather than shipping every density/ABI in one file):
```
npm run bundle:release
```
→ `android/app/build/outputs/bundle/release/app-release.aab`

**The release build type has R8 code + resource shrinking turned on** (`minifyEnabled true`, `shrinkResources true` — see `android/app/build.gradle`), with keep rules for Capacitor's bridge/plugin classes in `android/app/proguard-rules.pro` as a safety net. This meaningfully reduces APK/AAB size, but — unlike everything else in this checklist — it can't be fully validated by reading the source: R8 strips code based on static reachability analysis, and something reached only via reflection or a JS-bridge annotation R8 doesn't recognize could theoretically get stripped and only fail at runtime. **Always install and click through the actual signed release build on a device or emulator before shipping it** — specifically exercise Local Notifications (schedule a reminder), Background Runner (leave the app backgrounded past a 15-minute check), and Telegram backup/restore, since those are the three features that go through the Capacitor plugin bridge this pass added keep rules for. If anything misbehaves only in the release build (not debug), the fix is almost always an additional `-keep` rule in `proguard-rules.pro` for the specific class R8 stripped, not a functional code change.

## 6. Versioning

Bump both values in `android/app/build.gradle`'s `defaultConfig` before every release build:
- `versionCode` — integer, must strictly increase on every release (Play Store enforces this; sideloading doesn't, but keep the habit).
- `versionName` — the human-readable version string shown to the user.

## 7. Release checklist

Run through this before every release build, in order:

1. **Tests pass.** Re-run the functional test pass described in `PROJECT_SPEC.md` §8.7 (or your own equivalent) — it exercises CRUD, search, payments, programs, supplements, reports, backup/restore, and the Telegram/notifications platform boundaries against the real `domain`/`data` code.
2. **No syntax errors.** `node --check` every file under `src/` (or open the project in an editor with JS diagnostics) — cheap, catches anything a partial edit might have broken.
3. **PROJECT_SPEC.md is current.** If this release changed what the app does, the spec should already reflect it (see the spec's own running "what changed and why" notes under §8).
4. **Version bumped** (§6 above) — `versionCode` strictly greater than the last release, `versionName` updated, and a matching entry added to `CHANGELOG.md`.
5. **Keystore present and backed up** (§4) — confirm `android/keystore.properties` points at a keystore file that actually exists, and that you have an off-repo backup of both. There is no recovery path if this is lost.
6. **`npx cap sync android`** run since the last `src/` change, so the native project's assets are current.
7. **Build it**: `npm run build:release` (APK) or `npm run bundle:release` (AAB for Play Store).
8. **Smoke-test the actual signed release build on a device or emulator** — not just the debug build. This is the step that catches anything R8's minification (§5) could have broken, plus anything that only reproduces signed/release (vs. debug-signed) — install it, add a client, record a payment, trigger a reminder notification, run a manual backup, and confirm restore works from that backup file.

## 8. What's already configured vs. what needs your input

| Already done (this pass) | Needs your input |
|---|---|
| Permissions (`AndroidManifest.xml`) — Internet, notifications, exact alarm, boot receiver | Release keystore (§4 — must be generated locally, cannot be fabricated for you) |
| Adaptive launcher icon + splash screen (vector drawables, brand green + "W" mark — see §12 of `PROJECT_SPEC.md`) | Optional: replace the placeholder "W" monogram vector with real brand artwork later, same file locations |
| WorkManager-backed background reliability check (`@capacitor/background-runner`, see §12.4 of `PROJECT_SPEC.md`) | Confirm Google Play's background/notification permission policy is satisfied for your target audience before publishing (POST_NOTIFICATIONS + SCHEDULE_EXACT_ALARM both require a runtime permission prompt / Play Console declaration) |
| Gradle project structure, `package.json`, `capacitor.config.json` | Actually running `npm install` / `npx cap sync` / Gradle — none of this could be executed in the environment that authored these files (no Node, JDK, or Android SDK available there) |
