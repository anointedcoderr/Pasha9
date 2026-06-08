// Built by Anointed Coder.
//
// POST /api/me/push-subscriptions/test
//
// Sends a real Web Push payload to every active subscription owned
// by the current visitor so the user can verify their device is
// receiving notifications outside the website. The result includes
// per-channel diagnostics so the UI can render "VAPID missing",
// "no subscription on this device" or "delivered" honestly.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { dispatchPushToUsers } from '@/lib/push/dispatch';
import { isVapidConfigured } from '@/lib/push/vapid-provider';

export async function POST() {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`push-test:${session.sub}`, 5, 5 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const vapidConfigured = isVapidConfigured();
    const subCount = await db.pushSubscription.count({
      where: { userId: session.sub, isActive: true },
    });

    if (!vapidConfigured) {
      return jsonOk({
        ok: false,
        code: 'PROVIDER_SETUP_REQUIRED',
        message: 'VAPID keys are not configured on the server. Browser push will not dispatch until they are set.',
        diagnostics: { vapidConfigured: false, activeSubscriptions: subCount },
      });
    }
    if (subCount === 0) {
      return jsonOk({
        ok: false,
        code: 'NO_SUBSCRIPTION',
        message: 'No active push subscription on this account. Tap Enable device notifications first.',
        diagnostics: { vapidConfigured: true, activeSubscriptions: 0 },
      });
    }

    const result = await dispatchPushToUsers([session.sub], {
      title: 'Pasha 9',
      body: 'Test notification. If you see this, device push is working.',
      linkUrl: '/',
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PUSH_TEST',
      target: session.sub,
      meta: {
        attempted: result.attempted,
        sent: result.sent,
        failed: result.failed,
        status: result.status,
      },
    });

    return jsonOk({
      ok: result.status === 'sent' || result.status === 'partial',
      status: result.status,
      attempted: result.attempted,
      sent: result.sent,
      failed: result.failed,
      diagnostics: { vapidConfigured: true, activeSubscriptions: subCount },
    });
  });
}
