# Admin FCM Phone Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver real-time push notifications to admin phones (deposit, withdrawal, VIP application, reward claim, affiliate application) that fire with sound/vibration even when the screen is locked, the browser is closed, the admin is in another app, or not on the admin panel.

**Architecture:** Reuse the existing Firebase project (already wired for Phone Auth) for Cloud Messaging. Every admin event already funnels through the single `notifyAdmins()` function; we add a best-effort FCM dispatch there. Admins register a device token via an "Enable phone alerts" control; tokens live in a new `AdminPushDevice` table, kept separate from the player web-push `PushSubscription` table. A dedicated `firebase-messaging-sw.js` renders notifications with sound + vibration.

**Tech Stack:** Next.js 14 (app router), Prisma + PostgreSQL, `firebase` (web SDK, already installed `^12.14.0`), `firebase-admin` (already installed `^14.0.0`), TypeScript, `tsx` for script execution.

## Global Constraints

- **No new npm dependencies.** `firebase` and `firebase-admin` are already in [apps/web/package.json](../../../apps/web/package.json). Do not add OneSignal or any other package.
- **Do not touch the player web-push pipeline** ([lib/push/dispatch.ts](../../../apps/web/lib/push/dispatch.ts), [public/sw.js](../../../apps/web/public/sw.js), [/api/me/push-subscriptions](../../../apps/web/app/api/me/push-subscriptions/route.ts)). It serves player broadcasts and must keep working unchanged.
- **Best-effort delivery contract:** an FCM push failure must NEVER throw back into a player-facing request (deposit/withdrawal/VIP submit). All dispatch calls are wrapped so a transient FCM/DB error cannot fail the submit. This mirrors the existing fire-and-forget contract in [lib/notifications/notify.ts](../../../apps/web/lib/notifications/notify.ts).
- **Reuse existing config.** Server credentials `FIREBASE_PROJECT_ID` / `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` and public `NEXT_PUBLIC_FIREBASE_*` are already set for Phone Auth. The only new env var is `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- **File header:** every new source file starts with the comment line `// Built by Anointed Coder.` to match the repo convention (enforced loosely by [scripts/check-branding.mjs](../../../scripts/check-branding.mjs)).
- **Auth helpers:** admin API routes use `withAuth(async () => { const session = await requireStaff(); ... })` from [lib/auth/guard](../../../apps/web/lib/auth/guard.ts) / [lib/auth/rbac](../../../apps/web/lib/auth/rbac.ts). `session.sub` is the userId (string), `session.role` is the role key (string). Responses use `jsonOk(obj)` / `jsonError(status, code, message?)` from [lib/auth/errors](../../../apps/web/lib/auth/errors.ts). The Prisma client is `db` from [lib/db/client](../../../apps/web/lib/db/client.ts).
- **Recipient roles:** admin notifications already fan out to roles `super_admin`, `admin`, `staff` (`ADMIN_NOTIFY_ROLES` in notify.ts). Phone push targets exactly the opted-in subset of those users.
- **Verification idiom:** the repo has no unit-test runner. The gate is `pnpm --filter @pasha9/web typecheck` (`tsc --noEmit`), `pnpm --filter @pasha9/web build`, plus manual device smoke. Task 2 adds one `tsx` test for the only pure logic; everything else is gated by typecheck/build/manual steps as written.

---

## File Structure

**New files:**
- `packages/database/prisma/schema.prisma` - *modify*: add `AdminPushDevice` model + `User.adminPushDevices` back-relation.
- `apps/web/lib/push/fcm-status.ts` - pure helpers (status mapping, error classification). No app imports. Unit-tested.
- `apps/web/scripts/test-fcm-status.ts` - `tsx` unit test for `fcm-status.ts`.
- `apps/web/lib/firebase/admin.ts` - *modify*: add `getFirebaseAdminMessaging()`.
- `apps/web/lib/push/fcm.ts` - server dispatcher `dispatchFcmToUsers()`.
- `apps/web/app/api/admin/push-config/route.ts` - `GET` provider status + public VAPID key.
- `apps/web/app/api/admin/push-devices/route.ts` - `POST`/`DELETE` register/unregister token.
- `apps/web/app/api/admin/push-devices/test/route.ts` - `POST` self-test push.
- `apps/web/lib/notifications/notify.ts` - *modify*: add VIP kind + helper, wire FCM into `notifyAdmins()`.
- `apps/web/app/api/vip/apply/route.ts` - *modify*: use the new VIP helper.
- `apps/web/public/firebase-messaging-sw.js` - FCM background service worker.
- `apps/web/lib/firebase/client.ts` - *modify*: export `getFirebaseClientApp()`.
- `apps/web/lib/push/fcm-client.ts` - client enable/disable/state helpers.
- `apps/web/components/admin/AdminPushToggle.tsx` - enable/disable + test UI.
- `apps/web/components/admin/AdminPushPrompt.tsx` - one-time in-shell prompt banner.
- `apps/web/app/(admin)/admin/notifications/page.tsx` - *modify*: mount `AdminPushToggle`.
- `apps/web/app/(admin)/admin/layout.tsx` (or the admin shell) - *modify*: mount `AdminPushPrompt`.
- `.env.example` - *modify*: document `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- `docs/admin-push-deploy.md` - operator deploy guide.

---

## Task 1: AdminPushDevice Prisma model + migration

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (User model ~line 243; new model near `PushSubscription` ~line 2480)

**Interfaces:**
- Produces: Prisma model `AdminPushDevice` with fields `id, userId, token (unique), userAgent?, deviceLabel?, isActive, createdAt, updatedAt, lastSeenAt, failedAt?, failureReason?` and relation `user`. Later tasks use `db.adminPushDevice`.

- [ ] **Step 1: Add the back-relation on User**

In `packages/database/prisma/schema.prisma`, find this line inside `model User` (~line 243):

```prisma
  pushSubscriptions    PushSubscription[]
```

Add immediately after it:

```prisma
  adminPushDevices     AdminPushDevice[]
```

- [ ] **Step 2: Add the model**

In `packages/database/prisma/schema.prisma`, immediately after the closing `}` of `model PushSubscription` (~line 2498), insert:

```prisma
// FCM registration token for an admin's phone, registered when a staff
// user taps "Enable phone alerts" in the admin panel. One row per
// (admin user, device token) so a single admin can receive push on
// multiple phones. Kept separate from the player-facing PushSubscription
// table so the admin phone-alert flow and the player web-push flow never
// interfere. The dispatcher (lib/push/fcm.ts) only sends to isActive=true
// rows and flips the flag off when FCM returns a token-not-registered
// error.
model AdminPushDevice {
  id            String    @id @default(cuid())
  userId        String
  token         String    @unique
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

- [ ] **Step 3: Format + validate the schema**

Run: `pnpm --filter @pasha9/database exec prisma format`
Then: `pnpm --filter @pasha9/database exec prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 4: Create the migration + regenerate client (dev DB)**

Run: `pnpm --filter @pasha9/database exec prisma migrate dev --name admin_push_device`
Expected: a new folder under `packages/database/prisma/migrations/` and `Your database is now in sync with your schema.` followed by `Generated Prisma Client`.

> If no local dev DB is reachable, instead run `pnpm --filter @pasha9/database exec prisma migrate dev --create-only --name admin_push_device` to author the migration SQL without applying, then `pnpm --filter @pasha9/database exec prisma generate`. The SQL file must `CREATE TABLE "AdminPushDevice"` with a unique index on `token`.

- [ ] **Step 5: Confirm the client has the new model**

Run: `node -e "const{PrismaClient}=require('@pasha9/database');const c=new PrismaClient();console.log(typeof c.adminPushDevice.findMany)"`
Expected: `function`

(If `@pasha9/database` does not re-export `PrismaClient`, run instead from `packages/database`: `node -e "const{PrismaClient}=require('@prisma/client');console.log(typeof new PrismaClient().adminPushDevice.findMany)"`.)

- [ ] **Step 6: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/database/prisma/migrations
git commit -m "feat(db): add AdminPushDevice model for admin FCM tokens"
```

---

## Task 2: Pure FCM status helpers (TDD)

**Files:**
- Create: `apps/web/lib/push/fcm-status.ts`
- Test: `apps/web/scripts/test-fcm-status.ts`

**Interfaces:**
- Produces:
  - `type FcmDispatchStatus = 'sent' | 'partial' | 'failed' | 'provider_setup_required' | 'skipped_no_subscriptions'`
  - `interface FcmDispatchResult { attempted: number; sent: number; failed: number; status: FcmDispatchStatus; details?: string | null }`
  - `classifyFcmSendError(code: string | undefined | null): 'expired' | 'transient'`
  - `summarizeFcmResult(attempted: number, sent: number, failed: number): FcmDispatchStatus`
- Consumes: nothing (pure module, no app imports - so the `tsx` test can import it by relative path without `@/` alias resolution).

- [ ] **Step 1: Write the failing test**

Create `apps/web/scripts/test-fcm-status.ts`:

```ts
// Built by Anointed Coder.
// Standalone unit test for the pure FCM status helpers. Run with:
//   cd apps/web && npx tsx scripts/test-fcm-status.ts
import assert from 'node:assert/strict';
import { classifyFcmSendError, summarizeFcmResult } from '../lib/push/fcm-status';

// classifyFcmSendError
assert.equal(classifyFcmSendError('messaging/registration-token-not-registered'), 'expired');
assert.equal(classifyFcmSendError('messaging/invalid-registration-token'), 'expired');
assert.equal(classifyFcmSendError('messaging/internal-error'), 'transient');
assert.equal(classifyFcmSendError(undefined), 'transient');
assert.equal(classifyFcmSendError(null), 'transient');

// summarizeFcmResult
assert.equal(summarizeFcmResult(0, 0, 0), 'skipped_no_subscriptions');
assert.equal(summarizeFcmResult(3, 3, 0), 'sent');
assert.equal(summarizeFcmResult(3, 0, 3), 'failed');
assert.equal(summarizeFcmResult(3, 1, 2), 'partial');

console.log('fcm-status: all assertions passed');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && npx tsx scripts/test-fcm-status.ts`
Expected: FAIL - `Cannot find module '../lib/push/fcm-status'` (module not created yet).

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/lib/push/fcm-status.ts`:

```ts
// Built by Anointed Coder.
//
// Pure helpers for the FCM admin push dispatcher. Kept free of any app
// imports (no Prisma, no firebase) so they are trivially unit-testable
// via tsx (see scripts/test-fcm-status.ts) and so the dispatcher's
// branching logic has a single tested source of truth.

export type FcmDispatchStatus =
  | 'sent'
  | 'partial'
  | 'failed'
  | 'provider_setup_required'
  | 'skipped_no_subscriptions';

export interface FcmDispatchResult {
  attempted: number;
  sent: number;
  failed: number;
  status: FcmDispatchStatus;
  details?: string | null;
}

// FCM error codes that mean the token is permanently dead and the
// AdminPushDevice row should be deactivated. Any other code is treated
// as transient (worth retrying on the next event).
export const EXPIRED_FCM_ERROR_CODES = new Set<string>([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
]);

export function classifyFcmSendError(code: string | undefined | null): 'expired' | 'transient' {
  if (code && EXPIRED_FCM_ERROR_CODES.has(code)) return 'expired';
  return 'transient';
}

// Maps aggregate counts to the result status. Mirrors the policy used
// by the player web-push dispatcher in lib/push/dispatch.ts so the two
// channels report status the same way.
export function summarizeFcmResult(attempted: number, sent: number, failed: number): FcmDispatchStatus {
  if (attempted === 0) return 'skipped_no_subscriptions';
  if (sent === attempted) return 'sent';
  if (sent === 0) return 'failed';
  return 'partial';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && npx tsx scripts/test-fcm-status.ts`
Expected: PASS - `fcm-status: all assertions passed`

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/push/fcm-status.ts apps/web/scripts/test-fcm-status.ts
git commit -m "feat(push): pure FCM status helpers + tsx unit test"
```

---

## Task 3: firebase-admin Messaging accessor

**Files:**
- Modify: `apps/web/lib/firebase/admin.ts`

**Interfaces:**
- Consumes: existing `isFirebaseConfigured()`, `readPrivateKey()`, env `FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY`.
- Produces: `getFirebaseAdminMessaging(): Messaging` (from `firebase-admin/messaging`). Throws `Error('FIREBASE_ADMIN_NOT_CONFIGURED')` when unconfigured. Shares the same cached `App` as `getFirebaseAdminAuth()`.

- [ ] **Step 1: Refactor app init into a shared accessor + add messaging**

In `apps/web/lib/firebase/admin.ts`, update the imports near the top:

```ts
import {
  getApps,
  initializeApp,
  cert,
  type App,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
```

Replace the cached-state declarations:

```ts
let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
```

with:

```ts
let cachedApp: App | null = null;
let cachedAuth: Auth | null = null;
let cachedMessaging: Messaging | null = null;
```

Add a private shared app accessor (place it directly above `getFirebaseAdminAuth`):

```ts
function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (!isFirebaseConfigured()) {
    throw new Error('FIREBASE_ADMIN_NOT_CONFIGURED');
  }
  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: readPrivateKey(),
    }),
  });
  return cachedApp;
}
```

Replace the body of `getFirebaseAdminAuth` so it reuses `getAdminApp()`:

```ts
export function getFirebaseAdminAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}
```

Add the new accessor immediately after `getFirebaseAdminAuth`:

```ts
// Server-side FCM messaging handle. Reuses the same credentials and
// cached app as Phone Auth. Used by lib/push/fcm.ts to send admin
// phone push. Throws FIREBASE_ADMIN_NOT_CONFIGURED when the service
// account env vars are missing.
export function getFirebaseAdminMessaging(): Messaging {
  if (cachedMessaging) return cachedMessaging;
  cachedMessaging = getMessaging(getAdminApp());
  return cachedMessaging;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors (exit 0).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/firebase/admin.ts
git commit -m "feat(firebase): expose admin Messaging handle reusing Phone Auth app"
```

---

## Task 4: Server FCM dispatcher

**Files:**
- Create: `apps/web/lib/push/fcm.ts`

**Interfaces:**
- Consumes: `db` (`db.adminPushDevice`), `getFirebaseAdminMessaging()` (Task 3), `isFirebaseConfigured()` (existing), `FcmDispatchResult` / `classifyFcmSendError` / `summarizeFcmResult` (Task 2).
- Produces:
  - `interface FcmPushPayload { title: string; body?: string | null; linkUrl?: string | null; kind?: string | null; priority?: 'low' | 'normal' | 'high'; notificationId?: string | null }`
  - `dispatchFcmToUsers(userIds: string[], payload: FcmPushPayload): Promise<FcmDispatchResult>`

- [ ] **Step 1: Write the dispatcher**

Create `apps/web/lib/push/fcm.ts`:

```ts
// Built by Anointed Coder.
//
// Server-side FCM dispatcher for ADMIN phone push. Sends to every
// active AdminPushDevice token belonging to the given admin user ids.
// Data-only messages: the visible notification is constructed by
// public/firebase-messaging-sw.js so vibration / requireInteraction /
// tap-routing are fully controlled and there is no duplicate
// notification. Best-effort: every call is wrapped by the caller so a
// failure here can never fail a player-facing submit.

import { db } from '@/lib/db/client';
import { isFirebaseConfigured, getFirebaseAdminMessaging } from '@/lib/firebase/admin';
import {
  type FcmDispatchResult,
  classifyFcmSendError,
  summarizeFcmResult,
} from '@/lib/push/fcm-status';

export interface FcmPushPayload {
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  kind?: string | null;
  priority?: 'low' | 'normal' | 'high';
  notificationId?: string | null;
}

// All notification data is passed as strings (FCM data values must be
// strings) and rendered by the service worker.
function buildDataPayload(payload: FcmPushPayload): Record<string, string> {
  return {
    title: payload.title,
    body: payload.body ?? '',
    linkUrl: payload.linkUrl ?? '/admin',
    kind: payload.kind ?? '',
    priority: payload.priority ?? 'normal',
    notificationId: payload.notificationId ?? '',
  };
}

export async function dispatchFcmToUsers(
  userIds: string[],
  payload: FcmPushPayload,
): Promise<FcmDispatchResult> {
  if (!isFirebaseConfigured()) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: 'Firebase admin not configured' };
  }
  if (userIds.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  const devices = await db.adminPushDevice.findMany({
    where: { userId: { in: userIds }, isActive: true },
    select: { id: true, token: true },
  });
  if (devices.length === 0) {
    return { attempted: 0, sent: 0, failed: 0, status: 'skipped_no_subscriptions' };
  }

  let messaging;
  try {
    messaging = getFirebaseAdminMessaging();
  } catch (err) {
    return { attempted: 0, sent: 0, failed: 0, status: 'provider_setup_required', details: err instanceof Error ? err.message : 'messaging init failed' };
  }

  const data = buildDataPayload(payload);
  const urgency = payload.priority === 'high' ? 'high' : 'normal';

  const tokens = devices.map((d) => d.token);
  const response = await messaging.sendEachForMulticast({
    tokens,
    data,
    webpush: {
      headers: { Urgency: urgency, TTL: '3600' },
      fcmOptions: { link: payload.linkUrl ?? '/admin' },
    },
  });

  let sent = 0;
  let failed = 0;
  const now = new Date();
  await Promise.all(
    response.responses.map(async (res, i) => {
      const device = devices[i];
      if (res.success) {
        sent += 1;
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { lastSeenAt: now, failedAt: null, failureReason: null },
        }).catch(() => {});
        return;
      }
      failed += 1;
      const code = res.error?.code;
      const message = res.error?.message ?? String(res.error);
      if (classifyFcmSendError(code) === 'expired') {
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { isActive: false, failedAt: now, failureReason: (code ?? message).slice(0, 200) },
        }).catch(() => {});
      } else {
        await db.adminPushDevice.update({
          where: { id: device.id },
          data: { failedAt: now, failureReason: message.slice(0, 200) },
        }).catch(() => {});
      }
    }),
  );

  return { attempted: tokens.length, sent, failed, status: summarizeFcmResult(tokens.length, sent, failed) };
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors. (If `messaging` is flagged as implicitly typed, change `let messaging;` to `let messaging: ReturnType<typeof getFirebaseAdminMessaging>;`.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/push/fcm.ts
git commit -m "feat(push): server FCM dispatcher for admin devices"
```

---

## Task 5: push-config + push-devices API routes

**Files:**
- Create: `apps/web/app/api/admin/push-config/route.ts`
- Create: `apps/web/app/api/admin/push-devices/route.ts`

**Interfaces:**
- Consumes: `withAuth`, `requireStaff`, `recordActivity`, `jsonOk`, `jsonError`, `db`, `isFirebaseConfigured` (existing).
- Produces:
  - `GET /api/admin/push-config` → `{ ok: true, configured: boolean, vapidKey: string | null }`
  - `POST /api/admin/push-devices` body `{ token: string, userAgent?: string|null, deviceLabel?: string|null }` → `{ ok: true, deviceId: string }`
  - `DELETE /api/admin/push-devices` body `{ token: string }` → `{ ok: true }`

- [ ] **Step 1: Write the push-config route**

Create `apps/web/app/api/admin/push-config/route.ts`:

```ts
// Built by Anointed Coder.
//
// GET /api/admin/push-config
// Tells the admin "Enable phone alerts" UI whether FCM phone push is
// usable: `configured` is true only when the server can SEND (firebase
// admin creds present) AND the public VAPID key needed by the browser
// getToken() call is set. The VAPID public key is safe to expose.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { isFirebaseConfigured } from '@/lib/firebase/admin';

export async function GET() {
  return withAuth(async () => {
    await requireStaff();
    const vapidKey = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim() || null;
    return jsonOk({
      configured: isFirebaseConfigured() && Boolean(vapidKey),
      vapidKey,
    });
  });
}
```

- [ ] **Step 2: Write the push-devices route**

Create `apps/web/app/api/admin/push-devices/route.ts`:

```ts
// Built by Anointed Coder.
//
// POST   /api/admin/push-devices   register an admin phone's FCM token
// DELETE /api/admin/push-devices   deactivate by token
//
// Staff-only. The token is issued by firebase/messaging getToken() on
// the admin's phone. One row per token (token is unique); re-registering
// the same token just refreshes ownership + lastSeenAt.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const registerSchema = z.object({
  token: z.string().min(20).max(4096),
  userAgent: z.string().max(500).optional().nullable(),
  deviceLabel: z.string().max(120).optional().nullable(),
});

const unregisterSchema = z.object({
  token: z.string().min(20).max(4096),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireStaff();
    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const row = await db.adminPushDevice.upsert({
      where: { token: data.token },
      create: {
        userId: session.sub,
        token: data.token,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: session.sub,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'ADMIN_PUSH_SUBSCRIBE',
      target: row.id,
      meta: { userAgent: data.userAgent ?? null },
    });

    return jsonOk({ ok: true, deviceId: row.id });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireStaff();
    const body = await req.json().catch(() => ({}));
    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const row = await db.adminPushDevice.findUnique({ where: { token: parsed.data.token } });
    if (!row || row.userId !== session.sub) return jsonOk({ ok: true });

    await db.adminPushDevice.update({
      where: { token: parsed.data.token },
      data: { isActive: false },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'ADMIN_PUSH_UNSUBSCRIBE',
      target: row.id,
    });

    return jsonOk({ ok: true });
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/api/admin/push-config apps/web/app/api/admin/push-devices
git commit -m "feat(api): admin push-config + push-devices register/unregister"
```

---

## Task 6: Self-test push route

**Files:**
- Create: `apps/web/app/api/admin/push-devices/test/route.ts`

**Interfaces:**
- Consumes: `withAuth`, `requireStaff`, `jsonOk`, `dispatchFcmToUsers` (Task 4).
- Produces: `POST /api/admin/push-devices/test` → `{ ok: true, push: FcmDispatchResult }`

- [ ] **Step 1: Write the test route**

Create `apps/web/app/api/admin/push-devices/test/route.ts`:

```ts
// Built by Anointed Coder.
//
// POST /api/admin/push-devices/test
// Sends a test phone push to the calling admin's own active devices so
// they can confirm delivery (sound + vibration, screen locked, etc.)
// without waiting for a real player event.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { dispatchFcmToUsers } from '@/lib/push/fcm';

export async function POST() {
  return withAuth(async () => {
    const session = await requireStaff();
    const push = await dispatchFcmToUsers([session.sub], {
      title: 'Pasha 9 - test alert',
      body: 'Phone alerts are working. You will be notified of new deposits, withdrawals and VIP applications.',
      linkUrl: '/admin',
      kind: 'admin_test',
      priority: 'high',
    });
    return jsonOk({ ok: true, push });
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/admin/push-devices/test
git commit -m "feat(api): admin self-test push route"
```

---

## Task 7: VIP application admin kind + helper + wire VIP route

**Files:**
- Modify: `apps/web/lib/notifications/notify.ts` (kind union ~line 47-51; new helper after `notifyAdminsAffiliateApplicationPending` ~line 494)
- Modify: `apps/web/app/api/vip/apply/route.ts` (import ~line 19; call ~line 67)

**Interfaces:**
- Produces: `notifyAdminsVipApplicationPending(input: { applicationId: string; userId: string; tierName: string }): Promise<void>` and the kind `'admin_vip_application_pending'`.

- [ ] **Step 1: Add the kind to the union**

In `apps/web/lib/notifications/notify.ts`, find the admin-targeted kinds block:

```ts
  | 'admin_affiliate_application_pending'
  | 'admin_promotion_claim_pending';
```

Replace with:

```ts
  | 'admin_affiliate_application_pending'
  | 'admin_promotion_claim_pending'
  | 'admin_vip_application_pending';
```

- [ ] **Step 2: Add the helper**

In `apps/web/lib/notifications/notify.ts`, after the end of `notifyAdminsAffiliateApplicationPending` (the final `}` near line 494), append:

```ts
export async function notifyAdminsVipApplicationPending(input: {
  applicationId: string;
  userId: string;
  tierName: string;
}): Promise<void> {
  const who = await resolvePlayerHandle(input.userId);
  await notifyAdmins({
    kind: 'admin_vip_application_pending',
    titleEn: `New VIP application: ${input.tierName}`,
    titleBn: `নতুন ভিআইপি আবেদন: ${input.tierName}`,
    bodyEn: `${who} applied for the VIP Club (${input.tierName}). Ref ${shortRef(input.applicationId)}. Review at /admin/vip.`,
    bodyBn: `${who} ভিআইপি ক্লাবে আবেদন করেছেন (${input.tierName})। Ref ${shortRef(input.applicationId)}.`,
    linkUrl: '/admin/vip',
    priority: 'normal',
  });
}
```

- [ ] **Step 3: Wire the VIP route to the new helper**

In `apps/web/app/api/vip/apply/route.ts`, change the import (line ~19):

```ts
import { notifyAdmins } from '@/lib/notifications/notify';
```

to:

```ts
import { notifyAdminsVipApplicationPending } from '@/lib/notifications/notify';
```

Replace the existing `notifyAdmins({ ... }).catch(() => {});` block (lines ~67-75) with:

```ts
    // Bell ping + phone push for staff
    notifyAdminsVipApplicationPending({
      applicationId: application.id,
      userId: session.sub,
      tierName,
    }).catch(() => {});
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/notifications/notify.ts apps/web/app/api/vip/apply/route.ts
git commit -m "feat(notify): dedicated admin_vip_application_pending kind + helper"
```

---

## Task 8: Wire FCM dispatch into notifyAdmins

**Files:**
- Modify: `apps/web/lib/notifications/notify.ts` (import near top; `notifyAdmins` body ~line 357-396)

**Interfaces:**
- Consumes: `dispatchFcmToUsers` (Task 4).
- Produces: every admin event (deposit/withdrawal/reward/affiliate/VIP) now also fires a phone push, because they all route through `notifyAdmins`.

- [ ] **Step 1: Import the dispatcher**

In `apps/web/lib/notifications/notify.ts`, just below the existing `import { db } from '@/lib/db/client';` (line 19), add:

```ts
import { dispatchFcmToUsers } from '@/lib/push/fcm';
```

- [ ] **Step 2: Fire FCM after the recipient writes**

In `notifyAdmins`, locate the end of the recipient-insert loop and the `return n.id;`:

```ts
      await db.notificationRecipient.createMany({
        data: admins.slice(i, i + CHUNK).map((a) => ({
          notificationId: n.id,
          userId: a.id,
          deliveredAt: now,
        })),
        skipDuplicates: true,
      });
    }
    return n.id;
```

Insert the FCM dispatch between the closing `}` of the `for` loop and `return n.id;`:

```ts
      await db.notificationRecipient.createMany({
        data: admins.slice(i, i + CHUNK).map((a) => ({
          notificationId: n.id,
          userId: a.id,
          deliveredAt: now,
        })),
        skipDuplicates: true,
      });
    }

    // Best-effort phone push to every opted-in admin device. Not
    // awaited so it never adds latency to the player-facing submit that
    // triggered this notification; this runs on the persistent PM2 node
    // process so the floating promise completes. Errors are swallowed -
    // the in-app bell row above is the guaranteed channel.
    void dispatchFcmToUsers(admins.map((a) => a.id), {
      title: opts.titleEn,
      body: opts.bodyEn ?? null,
      linkUrl: opts.linkUrl ?? null,
      kind: opts.kind,
      priority: opts.priority ?? 'normal',
      notificationId: n.id,
    }).catch((err) => console.error('[notifyAdmins] fcm dispatch failed', opts.kind, err));

    return n.id;
```

- [ ] **Step 3: Typecheck + build**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors.
Run: `pnpm --filter @pasha9/web build`
Expected: build succeeds; `verify-build` smoke passes.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/notifications/notify.ts
git commit -m "feat(notify): fan out admin events to FCM phone push"
```

---

## Task 9: FCM background service worker

**Files:**
- Create: `apps/web/public/firebase-messaging-sw.js`

**Interfaces:**
- Consumes: firebase config passed via the SW registration query string (Task 10 registers it).
- Produces: a service worker that renders data messages as notifications (sound + vibration, `requireInteraction` for high priority) and routes taps to `data.linkUrl`.

> The SW imports firebase compat from gstatic. Pin `FB_SDK_VERSION` to the installed `firebase` version (`12.14.0`). If DevTools → Application → Service Workers shows an importScripts 404, bump/lower this constant to a version gstatic hosts (e.g. `10.12.2`) - the SW protocol is version-independent of the app SDK.

- [ ] **Step 1: Write the service worker**

Create `apps/web/public/firebase-messaging-sw.js`:

```js
// Built by Anointed Coder.
// FCM background service worker for ADMIN phone push. Separate scope
// from the player web-push worker (public/sw.js). Firebase config is
// passed in via the registration query string so env stays the single
// source of truth. Renders data-only messages with sound + vibration
// and routes taps to the admin link.

const FB_SDK_VERSION = '12.14.0';
importScripts(`https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-app-compat.js`);
importScripts(`https://www.gstatic.com/firebasejs/${FB_SDK_VERSION}/firebase-messaging-compat.js`);

const params = new URL(self.location).searchParams;
const firebaseConfig = {
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
};

let messaging = null;
try {
  firebase.initializeApp(firebaseConfig);
  messaging = firebase.messaging();
} catch (err) {
  // If config is missing the worker still installs; it just won't
  // render background messages. The enable flow guards against this.
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

function showFromData(data) {
  const d = data || {};
  const title = d.title || 'Pasha 9';
  const options = {
    body: d.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: d.kind || undefined,
    renotify: !!d.kind,
    requireInteraction: d.priority === 'high',
    vibrate: [200, 100, 200],
    data: { linkUrl: d.linkUrl || '/admin', kind: d.kind || null, notificationId: d.notificationId || null },
  };
  return self.registration.showNotification(title, options);
}

if (messaging) {
  messaging.onBackgroundMessage((payload) => {
    showFromData(payload && payload.data);
  });
}

// Fallback: some platforms (and any non-FCM-wrapped push) deliver a
// raw push event. Render it too, guarding against a double-show when
// onBackgroundMessage already handled an FCM payload.
self.addEventListener('push', (event) => {
  let parsed = null;
  try {
    parsed = event.data ? event.data.json() : null;
  } catch (_e) {
    parsed = null;
  }
  // FCM payloads are handled by onBackgroundMessage; only render here
  // when this is a bare data push not wrapped by FCM.
  if (parsed && parsed.data && !parsed.from) {
    event.waitUntil(showFromData(parsed.data));
  } else if (parsed && parsed.title && !parsed.from) {
    event.waitUntil(showFromData(parsed));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const linkUrl = (event.notification.data && event.notification.data.linkUrl) || '/admin';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetUrl = new URL(linkUrl, self.registration.scope).href;
    for (const client of all) {
      if (client.url === targetUrl && 'focus' in client) return client.focus();
    }
    for (const client of all) {
      if ('focus' in client && 'navigate' in client) {
        try { await client.navigate(targetUrl); return client.focus(); } catch (_e) { /* next */ }
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
```

- [ ] **Step 2: Verify it is served**

Run: `pnpm --filter @pasha9/web build` then `pnpm --filter @pasha9/web start` (or `dev`), and in a browser open `http://localhost:3000/firebase-messaging-sw.js`.
Expected: the JS file is returned (HTTP 200), not a 404 / HTML page. (Files in `public/` are served at the site root by Next.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/public/firebase-messaging-sw.js
git commit -m "feat(push): FCM background service worker for admin alerts"
```

---

## Task 10: Client FCM helpers

**Files:**
- Modify: `apps/web/lib/firebase/client.ts` (add `getFirebaseClientApp()`)
- Create: `apps/web/lib/push/fcm-client.ts`

**Interfaces:**
- Consumes: `firebase/messaging` (`isSupported`, `getMessaging`, `getToken`, `deleteToken`), `NEXT_PUBLIC_FIREBASE_*` env, `GET /api/admin/push-config`, `POST`/`DELETE /api/admin/push-devices`.
- Produces:
  - `getFirebaseClientApp(): FirebaseApp | null` (in client.ts)
  - `type AdminPushState = { supported: boolean; permission: NotificationPermission; enabled: boolean }`
  - `getAdminPushState(): Promise<AdminPushState>`
  - `type EnableAdminPushResult = { ok: true } | { ok: false; code: string; message: string }`
  - `enableAdminPush(): Promise<EnableAdminPushResult>`
  - `disableAdminPush(): Promise<{ ok: boolean }>`

- [ ] **Step 1: Export the client app from firebase/client.ts**

In `apps/web/lib/firebase/client.ts`, add this exported function after `getFirebaseClientAuth` (it reuses the same `cachedApp` / `readConfig`):

```ts
export function getFirebaseClientApp(): FirebaseApp | null {
  const cfg = readConfig();
  if (!cfg) return null;
  if (!cachedApp) {
    const existing = getApps()[0];
    cachedApp = existing ?? initializeApp(cfg);
  }
  return cachedApp;
}
```

- [ ] **Step 2: Write the client helpers**

Create `apps/web/lib/push/fcm-client.ts`:

```ts
// Built by Anointed Coder.
//
// Client-side FCM helpers for the admin "Enable phone alerts" control.
// Registers the dedicated firebase-messaging-sw.js (passing the public
// firebase config via the query string), requests Notification
// permission, fetches the FCM token, and posts it to
// /api/admin/push-devices. Mirrors the player lib/push/client.ts shape.

'use client';

import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { getFirebaseClientApp } from '@/lib/firebase/client';

export type AdminPushState = {
  supported: boolean;
  permission: NotificationPermission;
  enabled: boolean;
};

export type EnableAdminPushResult =
  | { ok: true }
  | { ok: false; code: 'unsupported' | 'no_config' | 'not_configured' | 'permission_denied' | 'token_failed' | 'post_failed'; message: string };

const SW_URL_BASE = '/firebase-messaging-sw.js';

function publicConfigQuery(): string | null {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(cfg).some((v) => !v)) return null;
  return new URLSearchParams(cfg as Record<string, string>).toString();
}

async function registerSw(): Promise<ServiceWorkerRegistration | null> {
  const query = publicConfigQuery();
  if (!query) return null;
  const url = `${SW_URL_BASE}?${query}`;
  const existing = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
  if (existing && existing.active && existing.active.scriptURL.endsWith(SW_URL_BASE.slice(1) + '?' + query)) {
    return existing;
  }
  return navigator.serviceWorker.register(url, { scope: '/firebase-cloud-messaging-push-scope' });
}

export async function getAdminPushState(): Promise<AdminPushState> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { supported: false, permission: 'default', enabled: false };
  }
  const supported = await isSupported().catch(() => false);
  const permission = Notification.permission;
  let enabled = false;
  try {
    const reg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    enabled = permission === 'granted' && Boolean(sub);
  } catch {
    enabled = false;
  }
  return { supported, permission, enabled };
}

export async function enableAdminPush(): Promise<EnableAdminPushResult> {
  if (typeof window === 'undefined') return { ok: false, code: 'unsupported', message: 'No window.' };
  if (!(await isSupported().catch(() => false))) {
    return { ok: false, code: 'unsupported', message: 'This browser does not support push. On iPhone, add the site to your Home Screen first.' };
  }

  // Confirm the operator finished server-side setup (creds + VAPID key).
  let vapidKey = '';
  try {
    const res = await fetch('/api/admin/push-config', { cache: 'no-store', credentials: 'include' });
    const j = await res.json();
    if (!j?.configured || !j?.vapidKey) {
      return { ok: false, code: 'not_configured', message: 'Phone alerts are not configured on the server yet.' };
    }
    vapidKey = j.vapidKey as string;
  } catch {
    return { ok: false, code: 'not_configured', message: 'Could not load push configuration.' };
  }

  const app = getFirebaseClientApp();
  if (!app) return { ok: false, code: 'no_config', message: 'Firebase web config is missing.' };

  const registration = await registerSw();
  if (!registration) return { ok: false, code: 'no_config', message: 'Firebase web config is missing.' };

  let permission = Notification.permission;
  if (permission === 'default') permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, code: 'permission_denied', message: 'Notification permission was not granted.' };
  }

  let token = '';
  try {
    const messaging = getMessaging(app);
    token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  } catch (err) {
    return { ok: false, code: 'token_failed', message: err instanceof Error ? err.message : 'Could not obtain a device token.' };
  }
  if (!token) return { ok: false, code: 'token_failed', message: 'Empty device token.' };

  try {
    const res = await fetch('/api/admin/push-devices', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, userAgent: navigator.userAgent }),
    });
    if (!res.ok) return { ok: false, code: 'post_failed', message: 'Could not register the device with the server.' };
  } catch {
    return { ok: false, code: 'post_failed', message: 'Could not reach the server.' };
  }

  return { ok: true };
}

export async function disableAdminPush(): Promise<{ ok: boolean }> {
  try {
    const app = getFirebaseClientApp();
    if (app) {
      const messaging = getMessaging(app);
      const reg = await navigator.serviceWorker.getRegistration('/firebase-cloud-messaging-push-scope');
      // Read the token before deleting so we can deactivate the server row.
      let token = '';
      try {
        const vapidKey = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim();
        if (reg && vapidKey) token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: reg });
      } catch { /* ignore */ }
      if (token) {
        await fetch('/api/admin/push-devices', {
          method: 'DELETE',
          credentials: 'include',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token }),
        }).catch(() => {});
      }
      await deleteToken(messaging).catch(() => {});
    }
  } catch { /* swallow */ }
  return { ok: true };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors. (If `URLSearchParams` rejects the typed object, the `as Record<string, string>` cast already present resolves it.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/firebase/client.ts apps/web/lib/push/fcm-client.ts
git commit -m "feat(push): client FCM enable/disable helpers for admin"
```

---

## Task 11: Admin enable UI (toggle + prompt) and mount

**Files:**
- Create: `apps/web/components/admin/AdminPushToggle.tsx`
- Create: `apps/web/components/admin/AdminPushPrompt.tsx`
- Modify: `apps/web/app/(admin)/admin/notifications/page.tsx` (mount the toggle)
- Modify: the admin shell layout that renders `AdminTopbar` (mount the prompt)

**Interfaces:**
- Consumes: `enableAdminPush`, `disableAdminPush`, `getAdminPushState` (Task 10).
- Produces: `AdminPushToggle` (default-styled card) and `AdminPushPrompt` (dismissible banner) React client components.

- [ ] **Step 1: Build the toggle component**

Create `apps/web/components/admin/AdminPushToggle.tsx`:

```tsx
// Built by Anointed Coder.
//
// Admin "Enable phone alerts" control. Lets a staff user register THIS
// device for FCM phone push and send a test. Shown on the admin
// notifications page. Reuses lib/push/fcm-client.ts.

'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Send, Loader2 } from 'lucide-react';
import { enableAdminPush, disableAdminPush, getAdminPushState } from '@/lib/push/fcm-client';

export function AdminPushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const s = await getAdminPushState();
    setSupported(s.supported);
    setEnabled(s.enabled);
  };

  useEffect(() => { refresh(); }, []);

  const onEnable = async () => {
    setBusy(true); setMsg(null);
    const res = await enableAdminPush();
    setBusy(false);
    if (res.ok) { setMsg('Phone alerts enabled on this device.'); await refresh(); }
    else setMsg(res.message);
  };

  const onDisable = async () => {
    setBusy(true); setMsg(null);
    await disableAdminPush();
    setBusy(false);
    setMsg('Phone alerts disabled on this device.');
    await refresh();
  };

  const onTest = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/push-devices/test', { method: 'POST', credentials: 'include' });
      const j = await res.json();
      setMsg(j?.push?.sent > 0 ? 'Test sent - check your phone.' : `No device received it (status: ${j?.push?.status ?? 'unknown'}).`);
    } catch {
      setMsg('Could not send the test.');
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-brand-divider bg-brand-paper p-5">
      <div className="flex items-center gap-2">
        {enabled ? <BellRing className="h-5 w-5 text-emerald-600" /> : <BellOff className="h-5 w-5 text-brand-inkSoft" />}
        <h3 className="text-sm font-extrabold text-brand-ink">Phone push alerts</h3>
      </div>
      <p className="mt-1 text-xs text-brand-inkSoft">
        Get a push notification on this phone for new deposits, withdrawals, VIP applications and other admin actions -
        even when the screen is locked or the browser is closed. On iPhone, add this site to your Home Screen first.
      </p>

      {!supported ? (
        <p className="mt-3 text-xs font-semibold text-amber-600">
          This browser can’t receive push here. On iPhone: Share → Add to Home Screen, open that, then enable.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {enabled ? (
            <button type="button" disabled={busy} onClick={onDisable}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-divider px-3 py-2 text-xs font-bold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Disable on this device
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={onEnable}
              className="inline-flex items-center gap-2 rounded-lg bg-grad-yellow px-3 py-2 text-xs font-extrabold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Enable phone alerts
            </button>
          )}
          {enabled && (
            <button type="button" disabled={busy} onClick={onTest}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-divider px-3 py-2 text-xs font-bold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
            </button>
          )}
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-brand-inkSoft">{msg}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build the one-time prompt banner**

Create `apps/web/components/admin/AdminPushPrompt.tsx`:

```tsx
// Built by Anointed Coder.
//
// One-time, dismissible banner shown in the admin shell when phone push
// is supported but not yet enabled on this device. Makes the feature
// discoverable the first time an admin opens the panel on their phone.
// Dismissal is remembered per-device via localStorage.

'use client';

import { useEffect, useState } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { enableAdminPush, getAdminPushState } from '@/lib/push/fcm-client';

const DISMISS_KEY = 'pasha9_admin_push_prompt_dismissed';

export function AdminPushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const s = await getAdminPushState();
      if (s.supported && !s.enabled) setShow(true);
    })();
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  const onEnable = async () => {
    setBusy(true); setMsg(null);
    const res = await enableAdminPush();
    setBusy(false);
    if (res.ok) { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } setShow(false); }
    else setMsg(res.message);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-brand-divider bg-brand-yellow-500/[0.08] px-4 py-2.5 md:px-6">
      <BellRing className="h-4 w-4 shrink-0 text-brand-yellow-700" />
      <p className="min-w-0 flex-1 text-xs font-semibold text-brand-ink">
        Turn on phone alerts to get notified of new deposits, withdrawals and VIP applications on this device.
        {msg ? <span className="ml-2 font-normal text-brand-inkSoft">{msg}</span> : null}
      </p>
      <button type="button" disabled={busy} onClick={onEnable}
        className="inline-flex items-center gap-2 rounded-lg bg-grad-yellow px-3 py-1.5 text-xs font-extrabold text-brand-ink disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enable
      </button>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="text-brand-inkSoft hover:text-brand-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Mount the toggle on the admin notifications page**

Open `apps/web/app/(admin)/admin/notifications/page.tsx` - this is the notifications settings hub and is already a `'use client'` component, so the client toggle drops in directly. Add the import with the other imports at the top:

```tsx
import { AdminPushToggle } from '@/components/admin/AdminPushToggle';
```

Render `<AdminPushToggle />` near the top of the returned JSX, directly under the `<PageHeader ... />` element (the page uses `PageHeader` as its first child). Place it as the first card so the admin sees it immediately:

```tsx
<PageHeader ... />
<AdminPushToggle />
```

- [ ] **Step 4: Mount the prompt in the admin shell**

The admin shell that renders `<AdminTopbar ... />` is `apps/web/app/(admin)/admin/layout.tsx` (confirmed - it is the only layout importing `AdminTopbar`). Open it and add the import:

```tsx
import { AdminPushPrompt } from '@/components/admin/AdminPushPrompt';
```

Render `<AdminPushPrompt />` immediately after the `<AdminTopbar ... />` element so the banner spans the content area below the topbar. If `layout.tsx` is a server component, that's fine - `AdminPushPrompt` is a `'use client'` component and can be rendered from a server component without changes.

- [ ] **Step 5: Typecheck + build**

Run: `pnpm --filter @pasha9/web typecheck`
Expected: no errors.
Run: `pnpm --filter @pasha9/web build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin/AdminPushToggle.tsx apps/web/components/admin/AdminPushPrompt.tsx "apps/web/app/(admin)/admin/notifications/page.tsx" apps/web/app
git commit -m "feat(admin): enable-phone-alerts toggle + discovery prompt"
```

---

## Task 12: Env docs + operator deploy guide

**Files:**
- Modify: `.env.example`
- Create: `docs/admin-push-deploy.md`

- [ ] **Step 1: Document the new env var**

In `.env.example`, add a section (after the existing `# ----- App` / database blocks, anywhere logical):

```bash
# ----- Admin phone push (FCM)
# Reuses the existing Firebase project already configured for Phone Auth
# (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY and
# the NEXT_PUBLIC_FIREBASE_* web config). The only additional value is the
# Web Push certificate PUBLIC key from:
#   Firebase Console > Project settings > Cloud Messaging > Web Push certificates
NEXT_PUBLIC_FIREBASE_VAPID_KEY=
```

- [ ] **Step 2: Write the operator deploy guide**

Create `docs/admin-push-deploy.md`:

```markdown
# Admin Phone Push (FCM) - Deploy Guide

Real-time push to admin phones for deposits, withdrawals, VIP applications,
reward claims and affiliate applications. Reuses the existing Firebase
project (the one already used for Phone Auth).

## 1. Get the Web Push key (one-time, Firebase Console)

1. Firebase Console → your project → **Project settings** (gear icon).
2. **Cloud Messaging** tab → **Web Push certificates** → **Generate key pair**.
3. Copy the **public key** string.

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

## 3. Apply the DB migration

```bash
cd /var/www/pasha9/app
pnpm --filter @pasha9/database exec prisma migrate deploy
```

This creates the `AdminPushDevice` table.

## 4. Rebuild + restart

```bash
cd /var/www/pasha9/app
pnpm --filter @pasha9/web build
pm2 restart pasha9-web --update-env
```

`--update-env` is required so the new `NEXT_PUBLIC_FIREBASE_VAPID_KEY` is
picked up.

## 5. Enable on each admin phone

- **Android (Chrome):** open the admin panel → log in → tap **Enable phone
  alerts** (banner at the top, or Notifications page) → **Send test**. Done.
- **iPhone (Safari):** open the admin panel in Safari → **Share → Add to Home
  Screen** → open the installed app from the Home Screen → log in → **Enable
  phone alerts** → **Send test**. (iOS only delivers background web push to an
  installed PWA - this step is required by Apple.)

## 6. Verify end-to-end

1. From the admin phone, tap **Send test** → a notification with sound +
   vibration should arrive even with the screen locked.
2. From a separate player account, submit a real deposit → the admin phone
   should receive the "New deposit" push within a couple of seconds.
3. Tap the notification → it should open `/admin/deposits`.

## Troubleshooting

- **Button says "not configured on the server yet":** `NEXT_PUBLIC_FIREBASE_VAPID_KEY`
  is missing or the build didn't pick it up - re-run step 4 with `--update-env`.
- **Service worker 404 / importScripts error (DevTools → Application → Service
  Workers):** the pinned `FB_SDK_VERSION` in `public/firebase-messaging-sw.js`
  isn't hosted on gstatic - set it to a version that is (e.g. `10.12.2`),
  rebuild, hard-refresh.
- **Android works, iPhone doesn't:** confirm the admin opened the **Home-Screen
  (installed) app**, not a Safari tab, and that iOS is 16.4+.
- **No push but bell still updates:** the in-app bell is the guaranteed channel;
  check `pm2 logs pasha9-web` for `[notifyAdmins] fcm dispatch failed` and verify
  the Firebase service-account env vars.
```

- [ ] **Step 3: Branding check**

Run: `node scripts/check-branding.mjs`
Expected: passes (exit 0). If it flags the new files, ensure each begins with `// Built by Anointed Coder.` (the SW, components, libs, routes all do per the code above).

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/admin-push-deploy.md
git commit -m "docs: admin phone push env var + operator deploy guide"
```

---

## Final verification (after all tasks)

- [ ] `pnpm --filter @pasha9/web typecheck` - no errors.
- [ ] `pnpm --filter @pasha9/web build` - succeeds, `verify-build` passes.
- [ ] `cd apps/web && npx tsx scripts/test-fcm-status.ts` - passes.
- [ ] Manual device smoke per `docs/admin-push-deploy.md` §6 on a real Android phone and an installed iPhone PWA.

---

## Self-Review Notes (author)

- **Spec coverage:** events (deposit/withdrawal/VIP/reward/affiliate) → Task 8 wires `notifyAdmins`, all five helpers route through it; VIP dedicated kind → Task 7. Data model → Task 1. Server messaging/dispatch → Tasks 3-4. APIs (config/register/test) → Tasks 5-6. SW → Task 9. Client + UI → Tasks 10-11. Deploy/env → Task 12. Delivery guarantees + iOS PWA caveat → Task 12 guide. Error handling (provider-not-configured, dead token, throw isolation) → Tasks 4 + 8.
- **Type consistency:** `FcmDispatchResult`/`FcmDispatchStatus` defined in Task 2, consumed in Tasks 4/6; `FcmPushPayload` defined in Task 4, consumed in Tasks 6/8; `dispatchFcmToUsers` signature stable across Tasks 4/6/8; `getFirebaseAdminMessaging` defined Task 3, used Task 4; `getFirebaseClientApp`/`enableAdminPush`/`disableAdminPush`/`getAdminPushState` defined Task 10, used Task 11; `db.adminPushDevice` from Task 1 used Tasks 4/5.
- **No placeholders:** every code step contains complete code. The two "locate the file" steps (Task 11 page/layout mount) include the exact `grep` to run and the exact import/JSX to add.
