# APK / mobile build

Pasha 9 is a Next.js web app. The fastest, lowest-risk way to ship
an Android APK is to wrap the production web app in **Capacitor**.
This document is the recipe and the asset checklist; the build is
done locally or on CI by a developer with Android SDK installed
(the production VPS cannot build the APK).

Built by Anointed Coder.

## Recommendation

**Capacitor WebView wrapper.** Reasons:
1. The web app is already production-ready and mobile-first.
2. Capacitor keeps the codebase single-source: every web change
   ships to the APK on next build.
3. PWA install is a non-negotiable fallback for users who reject
   the APK install permission.

We do NOT recommend a fork-the-codebase-to-React-Native rewrite
for M3. that is a separate engineering project.

## App identity (placeholder, change before submission)

| Field | Value |
| --- | --- |
| App name | `Pasha 9` |
| Bundle id | `com.pasha9.app` (placeholder; pick a stable id before first publish) |
| Version name | `1.0.0` |
| Version code | `1` |
| Min SDK | `24` (Android 7.0) |
| Target SDK | `34` |

## Required assets (place in `apps/web/public/app-assets/`)

Operator drops these files; the build script picks them up.

- `icon-1024.png`. 1024×1024 transparent PNG, used as the source
  for every adaptive launcher icon. **NOT** the existing browser
  favicon.
- `splash-2732.png`. 2732×2732 portrait splash source. Centre the
  logo in the middle 60% so the cropping on every device shape
  looks right.
- `notification-icon.png`. 96×96 white-on-transparent for the
  Android status-bar (if push notifications are wired later).

A placeholder icon and splash live in `apps/web/public/app-assets/`
(they are visibly placeholder so nobody ships them to the Play
Store by accident). Replace before any signed build.

## One-time setup on the build machine

```bash
# Tools (developer laptop, NOT the VPS)
# - Node 20.x, pnpm 8+
# - Android Studio with Android SDK Platform 34 + Build Tools 34
# - JDK 17 (Android Gradle Plugin 8+)

# Install Capacitor into the existing web workspace
pnpm --filter @pasha9/web add @capacitor/core @capacitor/cli @capacitor/android
pnpm --filter @pasha9/web exec cap init "Pasha 9" "com.pasha9.app" --web-dir=.next
pnpm --filter @pasha9/web exec cap add android
```

The first `cap init` creates `apps/web/capacitor.config.ts`. Edit:

```ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.pasha9.app',
  appName: 'Pasha 9',
  // The APK does NOT bundle Next.js; it loads the production
  // website. This keeps the APK ~8 MB and means every web deploy
  // ships to the app automatically.
  server: { url: 'https://pasha9.com', cleartext: false },
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // flip to true ONLY in dev
  },
};

export default config;
```

## Build commands

```bash
# Web build (so the Capacitor sync has a known-good static asset
# baseline; the APK itself still loads the live site)
pnpm --filter @pasha9/web build

# Generate icons + splash from the source PNGs above
pnpm --filter @pasha9/web exec cap assets generate --android

# Sync into the android/ project
pnpm --filter @pasha9/web exec cap sync android

# Open in Android Studio for the first signed build
pnpm --filter @pasha9/web exec cap open android
# In Android Studio:
#   Build -> Generate Signed Bundle / APK -> APK
#   Pick or create release keystore -> remember the password!
#   Output: apps/web/android/app/release/app-release.apk
```

For CI builds (Gradle on Linux):

```bash
cd apps/web/android
./gradlew assembleRelease \
  -PpashaKeystoreFile="$PASHA_KEYSTORE" \
  -PpashaKeystorePassword="$PASHA_KEYSTORE_PASS" \
  -PpashaKeyAlias="$PASHA_KEY_ALIAS" \
  -PpashaKeyPassword="$PASHA_KEY_PASS"
```

## Mobile session handling notes

- Authentication is cookie-based via `/api/auth/me`. The WebView
  must preserve cookies across launches. Capacitor's default
  WebView (Android System WebView) does. **Do not** enable any
  "incognito" or "private" WebView setting.
- DepositRequiredModal works inside the WebView because it is a
  full client component reading `/api/auth/me` over the same
  cookie. No native bridge required.
- Provider launch redirects to `https://igamingapis.live/...`. The
  WebView allowlist must include the provider's launch + return
  domain. Update `android/app/src/main/res/xml/network_security_config.xml`
  if a tighter pin is wanted (defaults are fine for first APK).
- Push notifications, biometric login and other native features
  are OUT of scope for M3. Add Capacitor plugins later if asked.

## APK build checklist

- [ ] `apps/web/public/app-assets/icon-1024.png` is the real icon.
- [ ] `apps/web/public/app-assets/splash-2732.png` is the real splash.
- [ ] `capacitor.config.ts` `appId` matches the Play Store listing.
- [ ] `versionName` and `versionCode` bumped from previous release.
- [ ] Release keystore is backed up (loss = no app updates ever).
- [ ] `pnpm --filter @pasha9/web build` clean before sync.
- [ ] `cap assets generate --android` ran successfully.
- [ ] `cap sync android` ran successfully.
- [ ] APK installs cleanly on a sideload device.
- [ ] Cookies survive `force-stop` + relaunch (login persists).
- [ ] Provider launch opens within the WebView (no external
      Chrome handoff).
- [ ] DepositRequiredModal opens for a zero-balance user.

## PWA install (fallback while the APK is pending)

Even before the first APK ships, users can install Pasha 9 as a
Progressive Web App. The web app already serves a manifest at
`/manifest.webmanifest` and a service worker is registered when
`?pwa=1` is appended or Add to Home Screen is used.

If the operator wants a fully-fledged installable PWA before APK
day-1, the only missing piece is a high-res `icon-512.png` in
`apps/web/public/app-assets/` and a single edit to
`apps/web/app/layout.tsx` to wire the manifest into `<head>`. The
PWA path is documented for completeness. it is not blocked by
APK tooling.

