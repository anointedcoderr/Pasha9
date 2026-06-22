# Admin FCM Phone Push Notifications — Design

**Date:** 2026-06-22
**Author:** Anointed Coder (with Claude)
**Status:** Approved (pending spec review)
**Branch:** `m1-production`

## Problem

The admin currently sees deposit/withdrawal/VIP/etc. events only via the in-panel
notification bell ([AdminBell](../../../apps/web/components/admin/AdminBell.tsx)), which
polls `/api/admin/me/notifications` every 30s. This requires the admin to stay logged
into the panel. The client needs **real-time push notifications delivered to their phone**
that fire even when:

- the screen is locked,
- the browser is closed,
- they are using another app,
- they are not currently on the admin panel,

with a **sound / vibration** alert. Events that must trigger a phone push: new deposit
request, withdrawal request, VIP application, reward claim, and affiliate application
(i.e. every "important admin action" already routed to the bell).

## Chosen approach

**Firebase Cloud Messaging (FCM) web push**, reusing the existing Firebase project.

Decision context: the repo already ships `firebase` + `firebase-admin` (used today for
Phone Auth), the server service-account env vars (`FIREBASE_PROJECT_ID`,
`FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`), and the public web config
(`NEXT_PUBLIC_FIREBASE_*`). FCM Cloud Messaging reuses **all** of these. The only new
configuration is a single Web Push certificate public key
(`NEXT_PUBLIC_FIREBASE_VAPID_KEY`).

> Note: on the web, FCM and raw W3C/VAPID web push share the same transport (Chrome/Android
> routes web push through FCM). The client requested FCM specifically; using the Firebase
> SDK additionally provides the Firebase console as a test/send surface and a unified token
> model. The existing VAPID web-push pipeline used for *player* broadcasts
> ([lib/push/dispatch.ts](../../../apps/web/lib/push/dispatch.ts)) is left untouched.

## Architecture

```
Player submits deposit / withdrawal / VIP / reward / affiliate
        │
        ▼
notifyAdmins()  ← single chokepoint every admin event already calls
        │  (1) write Notification + NotificationRecipient rows   [unchanged → bell keeps working]
        │  (2) NEW: dispatchFcmToUsers(adminUserIds, payload)     [best-effort, non-blocking]
        ▼
lib/push/fcm.ts → firebase-admin getMessaging().sendEachForMulticast(tokens)
        │
        ▼
Google FCM → admin phone → public/firebase-messaging-sw.js
        renders notification (sound + vibration, requireInteraction for high priority,
        tap → opens /admin/<area>)
```

The admin registers each phone once via an **"Enable phone alerts"** control in the admin
panel. The token is stored against their `userId`. Every staff member
(`super_admin` / `admin` / `staff`) who opts in receives the push — matching the existing
bell fan-out (`ADMIN_NOTIFY_ROLES`).

## Components

### Data model (new)

`AdminPushDevice` — one row per (admin user, device token). Kept **separate** from the
player `PushSubscription` table so the admin phone-alert flow and the player web-push flow
never interfere.

```prisma
model AdminPushDevice {
  id            String    @id @default(cuid())
  userId        String
  token         String    @unique   // FCM registration token
  userAgent     String?
  deviceLabel   String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  lastSeenAt    DateTime  @default(now())
  failedAt      DateTime?
  failureReason String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, isActive])
}
```

Plus a back-relation `adminPushDevices AdminPushDevice[]` on the `User` model. Requires a
Prisma migration.

### Server

- **`lib/firebase/admin.ts`** — add `getFirebaseAdminMessaging(): Messaging` reusing the
  existing lazy/idempotent app init. No new credentials.
- **`lib/push/fcm.ts`** — `dispatchFcmToUsers(userIds: string[], payload): Promise<FcmDispatchResult>`:
  - returns `provider_setup_required` when `isFirebaseConfigured()` is false;
  - loads active tokens for `userIds`;
  - sends via `getMessaging().sendEachForMulticast(...)`;
  - on per-token errors `messaging/registration-token-not-registered` /
    `messaging/invalid-registration-token`, marks that `AdminPushDevice` inactive
    (`isActive=false`, `failureReason`); other errors stamp `failedAt` only;
  - returns `{ attempted, sent, failed, status }` mirroring the existing
    `PushDispatchResult` shape.
  - **Payload policy:** send a `data`-only message plus `webpush.fcmOptions.link`, and let
    `firebase-messaging-sw.js` construct the visible notification (so vibration /
    `requireInteraction` / tag are fully controlled and there is no duplicate
    notification). Include `webpush.headers.Urgency` based on priority. Exact payload shape
    finalized during implementation + device testing.

### API routes (all `requireStaff`)

- `POST   /api/admin/push-devices` — upsert FCM token by `token`, bind to `session.sub`,
  set `isActive=true`, record an activity log entry.
- `DELETE /api/admin/push-devices` — deactivate by `token` (scoped to caller).
- `POST   /api/admin/push-devices/test` — send a test push to the caller's own active
  tokens so the admin can confirm delivery on their phone.
- `GET    /api/admin/push-config` — returns `{ configured, vapidKey }` (public key only) so
  the enable UI can decide whether to offer the button or show "ask operator to finish
  setup".

### Client

- **`lib/push/fcm-client.ts`**:
  - `enableAdminPush()` — `isSupported()` from `firebase/messaging`; register
    `/firebase-messaging-sw.js` (firebase config passed via registration query string so
    env remains the single source of truth); `Notification.requestPermission()`;
    `getToken(messaging, { vapidKey, serviceWorkerRegistration })`; `POST` token to
    `/api/admin/push-devices`. Returns a typed result like the player `enableDevicePush()`.
  - `disableAdminPush()` — `deleteToken()` + `DELETE /api/admin/push-devices`.
  - `getAdminPushState()` — support + permission + subscribed status for the toggle UI.
- **`public/firebase-messaging-sw.js`** — `importScripts` firebase compat app + messaging,
  `initializeApp(config)`, `onBackgroundMessage` → `showNotification` with:
  - `vibrate: [200,100,200]`,
  - `requireInteraction: true` when `priority === 'high'`,
  - per-event `tag` (so repeated events of the same kind collapse) + `renotify`,
  - `data.linkUrl` for tap routing;
  - plus a `notificationclick` handler that focuses an existing admin tab or opens the
    target `/admin/...` URL (mirrors the existing [public/sw.js](../../../apps/web/public/sw.js)).
- **`AdminPushToggle`** component — enable/disable + "send test" button. Surfaced:
  1. on the admin notifications settings area, and
  2. as a one-time dismissible prompt banner inside the admin shell, shown when push is
     supported but not yet enabled, so it is discoverable the first time the admin opens
     the panel on their phone.

### Event wiring

- **`lib/notifications/notify.ts`** — inside `notifyAdmins()`, after the DB rows are
  written, resolve the admin `userId`s already fetched and call
  `dispatchFcmToUsers(adminIds, { title, body, linkUrl, kind, priority })`. Best-effort:
  wrapped so a push failure can never fail the player-facing submit (consistent with the
  existing fire-and-forget contract). Because every admin helper
  (`notifyAdminsDepositPending`, `notifyAdminsWithdrawalPending`,
  `notifyAdminsRewardClaimPending`, `notifyAdminsAffiliateApplicationPending`) funnels
  through `notifyAdmins`, all of them gain phone push from this one change.
- Add `admin_vip_application_pending` to `NotificationKind` and a
  `notifyAdminsVipApplicationPending()` helper; update
  [/api/vip/apply](../../../apps/web/app/api/vip/apply/route.ts) to use it instead of the
  current `admin_affiliate_application_pending` placeholder.

## Data flow (deposit example)

1. Player POSTs `/api/deposits`. Deposit row created.
2. Route calls `notifyAdminsDepositPending(...)` → `notifyAdmins(...)`.
3. `notifyAdmins` writes `Notification` + one `NotificationRecipient` per staff user
   (unchanged → bell badge updates within 30s as today).
4. `notifyAdmins` then calls `dispatchFcmToUsers(adminIds, payload)`.
5. FCM delivers to every active `AdminPushDevice` token for those admins.
6. `firebase-messaging-sw.js` renders the notification with sound + vibration on each phone,
   even with the screen locked / browser closed / another app foregrounded.
7. Admin taps → opens `/admin/deposits`.

## Delivery guarantees

| Condition | Android (Chrome) | iPhone (PWA, iOS 16.4+) |
|---|---|---|
| Screen locked | ✅ | ✅ |
| Browser closed | ✅ | ✅ |
| Using another app | ✅ | ✅ |
| Not on admin panel | ✅ | ✅ |
| Sound + vibration | ✅ | ✅ |

iPhone requires a one-time **Add to Home Screen** (install the PWA) before background web
push works — an Apple platform rule, not an FCM limitation, and unavoidable with any web
push provider. Android needs no install. A `manifest.ts` PWA manifest already exists.

## Error handling

- **Firebase not configured / VAPID key missing** → `dispatchFcmToUsers` returns
  `provider_setup_required` and the enable UI shows a setup-required message. The bell path
  is wholly unaffected, so admins still get in-panel notifications.
- **Dead / expired token** → marked `isActive=false` on
  `registration-token-not-registered`; skipped on subsequent sends.
- **Transient send error** → `failedAt` stamped, token kept active for retry on the next
  event.
- **Push dispatch throws** → caught in `notifyAdmins`; never propagates to the
  player-facing request.

## Testing

- **Unit**: `dispatchFcmToUsers` token selection, dead-token deactivation, and
  result-status mapping (mock `getMessaging`).
- **Unit**: `notifyAdminsVipApplicationPending` writes the correct kind/link.
- **Integration**: registering a token via `POST /api/admin/push-devices` is scoped to the
  caller; `DELETE` only deactivates the caller's own token.
- **Manual (device)**: real Android phone + real iPhone (installed PWA) — enable, send test,
  trigger a real deposit from a player account, confirm delivery with screen locked /
  browser closed / app backgrounded, confirm sound + vibration, confirm tap routing.

## Deployment (VPS)

Full operator guide ships with the implementation. Summary:

1. Firebase Console → **Cloud Messaging → Web Push certificates → Generate key pair**; copy
   the public key.
2. Add `NEXT_PUBLIC_FIREBASE_VAPID_KEY=<public key>` to `/var/www/pasha9/app/.env`. Confirm
   the existing `NEXT_PUBLIC_FIREBASE_*` and server `FIREBASE_*` vars are present.
3. `pnpm --filter @pasha9/database prisma migrate deploy` (creates `AdminPushDevice`).
4. Rebuild (`pnpm --filter @pasha9/web build`) and `pm2 restart pasha9-web --update-env`.
5. On each admin phone: open the admin panel → log in → **Enable phone alerts** → **Send
   test**. iPhone: **Add to Home Screen** first, open the installed app, then enable.

## Out of scope (YAGNI)

- Per-event opt-in/quiet-hours per admin (all opted-in staff get all admin events).
- A native (store-published) mobile app.
- Migrating the existing player web-push pipeline onto FCM.
- Replacing the in-panel bell (it remains the always-available fallback channel).
