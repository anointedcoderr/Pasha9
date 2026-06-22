# Admin Phone Push (FCM) - Deploy Guide

Real-time push to admin phones for deposits, withdrawals, VIP applications,
reward claims and affiliate applications. Reuses the existing Firebase
project (the one already used for Phone Auth). The in-app admin bell keeps
working exactly as before - this adds a phone-push channel on top.

## 1. Get the Web Push key (one-time, Firebase Console)

1. Firebase Console → your project → **Project settings** (gear icon).
2. **Cloud Messaging** tab → **Web Push certificates** → **Generate key pair**.
3. Copy the **public key** string (it looks like a long `B...` base64 value).

## 2. Set the env var on the VPS

Edit `/var/www/pasha9/app/.env` and add:

```
NEXT_PUBLIC_FIREBASE_VAPID_KEY=<the public key from step 1>
```

Confirm these already exist (they were set for Phone Auth - do not change):
`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`,
`NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
`NEXT_PUBLIC_FIREBASE_PROJECT_ID`, `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`,
`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`, `NEXT_PUBLIC_FIREBASE_APP_ID`.

> If `FIREBASE_*` are NOT already set (i.e. Phone Auth was never configured on
> this server), set them too from the same Firebase project: the service
> account (Project settings → Service accounts → Generate new private key)
> gives you `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY`,
> and the web app config (Project settings → General → Your apps → SDK setup)
> gives the `NEXT_PUBLIC_FIREBASE_*` values.

## 3. Pull the code

```bash
cd /var/www/pasha9/app
git fetch --prune origin
git checkout m1-production        # or the branch you merged this into
git reset --hard origin/m1-production
pnpm install --frozen-lockfile
```

## 4. Apply the new table to the database

This project syncs schema changes with `prisma db push` (it does not use
incremental migration files - every model since the initial baseline was
shipped this way). Add the new `AdminPushDevice` table:

```bash
cd /var/www/pasha9/app
pnpm --filter @pasha9/database exec prisma generate
pnpm --filter @pasha9/database exec prisma db push
```

`db push` is non-destructive here - it only creates the new `AdminPushDevice`
table and its index; it does not touch existing tables or data. Expect output
ending in `Your database is now in sync with your Prisma schema.`

> The DB connection uses `DATABASE_URL` from the app `.env`. If `prisma db push`
> can't connect, run it with the URL inline:
> `DATABASE_URL="$(grep -m1 ^DATABASE_URL .env | cut -d= -f2-)" pnpm --filter @pasha9/database exec prisma db push`

## 5. Rebuild + restart

```bash
cd /var/www/pasha9/app
pnpm --filter @pasha9/web build
pm2 restart pasha9-web --update-env
```

`--update-env` is required so the new `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is
baked into the running process. (Because it is a `NEXT_PUBLIC_*` var it is
inlined at **build** time - so the `build` step above must run AFTER the env
var is set in step 2.)

## 6. Enable on each admin phone

- **Android (Chrome):** open the admin panel → log in → tap **Enable phone
  alerts** (the banner at the top of the panel, or the card on
  **Notifications**) → **Send test**. Done.
- **iPhone (Safari):** open the admin panel in Safari → **Share → Add to Home
  Screen** → open the installed app from the Home Screen → log in → **Enable
  phone alerts** → **Send test**. (iOS only delivers background web push to an
  installed PWA - this step is required by Apple, not by Firebase.)

Each staff member who wants alerts repeats this on their own phone. Tokens are
per-device, so the same person can enable it on multiple phones.

## 7. Verify end-to-end

1. From the admin phone, tap **Send test** → a notification with sound +
   vibration should arrive even with the screen locked.
2. From a separate player account, submit a real deposit → the admin phone
   should receive the "New deposit" push within a couple of seconds.
3. Tap the notification → it should open `/admin/deposits`.

## Troubleshooting

- **Button says "not configured on the server yet":** `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
  is missing or the build ran before it was set - re-run steps 2 + 5 (set the
  var, then rebuild).
- **Service worker 404 / importScripts error (DevTools → Application → Service
  Workers):** the pinned `FB_SDK_VERSION` in `apps/web/public/firebase-messaging-sw.js`
  isn't hosted on gstatic - set it to a version that is (e.g. `10.12.2`),
  rebuild, hard-refresh.
- **Android works, iPhone doesn't:** confirm the admin opened the **Home-Screen
  (installed) app**, not a Safari tab, and that iOS is 16.4+.
- **No push but the bell still updates:** the in-app bell is the guaranteed
  channel; check `pm2 logs pasha9-web` for `[notifyAdmins] fcm dispatch failed`
  and verify the Firebase service-account env vars are present.
- **`prisma db push` wants to drop/alter unrelated columns:** stop - that means
  the live DB has drifted from `schema.prisma`. Do not proceed; capture the diff
  and review before applying.
```
