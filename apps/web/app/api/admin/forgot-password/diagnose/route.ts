// Built by Anointed Coder.
//
// POST /api/admin/forgot-password/diagnose
//
// Operator-facing live diagnostic for the Firebase Phone Auth Forgot
// Password flow. Runs three checks and returns a structured report:
//
// 1. SystemSetting flag forgot_password_enabled
// 2. Server-side Firebase Admin SDK env present (FIREBASE_PROJECT_ID,
//    FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
// 3. Client-side env present (NEXT_PUBLIC_FIREBASE_* keys)
// 4. If a phone is supplied: BD phone normalisation passes + the
//    phone already exists in the user table (so the SMS is not a
//    waste)
// 5. ActivityLog: count of FORGOT_PHONE_VERIFY_OK / _FAIL /
//    _NO_USER / _BLOCKED in the last 24 hours

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isFirebaseConfigured } from '@/lib/firebase/admin';
import { bdPhoneVariants } from '@/lib/firebase/phone';

const schema = z.object({
  phone: z.string().trim().max(60).optional(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const flagRow = await db.systemSetting.findUnique({
      where: { key: 'forgot_password_enabled' },
      select: { value: true },
    });
    const flagOn = (flagRow?.value ?? '0').trim() === '1';

    const adminConfigured = isFirebaseConfigured();
    const adminEnv = {
      FIREBASE_PROJECT_ID: Boolean(process.env.FIREBASE_PROJECT_ID),
      FIREBASE_CLIENT_EMAIL: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
      FIREBASE_PRIVATE_KEY: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    };

    // The public NEXT_PUBLIC_* env is shipped to the client, so the
    // admin diagnostic just reports presence not value. Operator can
    // grep .env on the VPS to compare to what is shown here.
    const publicEnv = {
      NEXT_PUBLIC_FIREBASE_API_KEY: Boolean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: Boolean(process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: Boolean(process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET),
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID),
      NEXT_PUBLIC_FIREBASE_APP_ID: Boolean(process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
    };

    let phoneCheck: {
      ok: boolean;
      reason: string;
      e164?: string;
      userFound?: boolean;
    } | null = null;
    if (parsed.data.phone) {
      const variants = bdPhoneVariants(parsed.data.phone);
      if (!variants) {
        phoneCheck = { ok: false, reason: 'Not a valid Bangladesh mobile number (expected 01XXXXXXXXX format).' };
      } else {
        const user = await db.user.findFirst({
          where: { phone: { in: variants.all } },
          select: { id: true, status: true },
        });
        phoneCheck = {
          ok: !!user,
          reason: user
            ? user.status === 'blocked'
              ? 'Phone matches a BLOCKED user. Firebase verification will succeed but no reset token is issued.'
              : `Phone matches a user. Firebase verification will issue a reset token (user status: ${user.status}).`
            : 'No user is registered to this phone. Firebase will deliver the SMS but step 3 will surface "phone not registered".',
          e164: variants.e164,
          userFound: !!user,
        };
      }
    }

    // Last 24h ActivityLog stats so the operator can tell whether ANY
    // attempts hit the server at all (or whether Firebase is blocking
    // the SMS upstream).
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60_000);
    const [okCount, failCount, noUserCount, blockedCount, resetOk] = await Promise.all([
      db.activityLog.count({ where: { action: 'FORGOT_PHONE_VERIFY_OK', createdAt: { gte: oneDayAgo } } }),
      db.activityLog.count({ where: { action: 'FORGOT_PHONE_VERIFY_FAIL', createdAt: { gte: oneDayAgo } } }),
      db.activityLog.count({ where: { action: 'FORGOT_PHONE_VERIFY_NO_USER', createdAt: { gte: oneDayAgo } } }),
      db.activityLog.count({ where: { action: 'FORGOT_PHONE_VERIFY_BLOCKED', createdAt: { gte: oneDayAgo } } }),
      db.activityLog.count({ where: { action: 'FORGOT_PHONE_RESET_OK', createdAt: { gte: oneDayAgo } } }),
    ]);

    const checks = [
      { name: 'Feature flag', ok: flagOn, hint: flagOn ? 'forgot_password_enabled = 1.' : 'Flag is OFF. Toggle ON in /admin/forgot-password.' },
      { name: 'Server SDK env', ok: adminConfigured, hint: adminConfigured ? 'FIREBASE_PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY all present.' : 'One or more FIREBASE_* env vars missing. Check .env on the VPS and pm2 restart --update-env.' },
      { name: 'Public SDK env', ok: Object.values(publicEnv).every(Boolean), hint: Object.values(publicEnv).every(Boolean) ? 'NEXT_PUBLIC_FIREBASE_* env vars present.' : 'Missing NEXT_PUBLIC_FIREBASE_* keys - the client SDK cannot initialise.' },
    ];
    const overallOk = checks.every((c) => c.ok);

    return jsonOk({
      overallOk,
      flagOn,
      adminConfigured,
      adminEnv,
      publicEnv,
      checks,
      phoneCheck,
      activity24h: {
        verifyOk: okCount,
        verifyFail: failCount,
        verifyNoUser: noUserCount,
        verifyBlocked: blockedCount,
        resetOk,
      },
      nextSteps: overallOk
        ? [
            'Open /forgot-password in incognito on a phone.',
            'Enter a real BD mobile number. Tap "Send SMS code".',
            'If no SMS arrives within 60s, check the error text in the page (it will say auth/unauthorized-domain, auth/billing-not-enabled, etc.) and act on that.',
          ]
        : [
            ...(flagOn ? [] : ['Turn the toggle ON at /admin/forgot-password.']),
            ...(adminConfigured ? [] : ['Edit /var/www/pasha9/app/.env, ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY are set, then run pm2 restart pasha9-web --update-env.']),
            ...(Object.values(publicEnv).every(Boolean) ? [] : ['Same env file - the NEXT_PUBLIC_FIREBASE_* keys also need to be set, AND require a full rebuild (pnpm --filter @pasha9/web build) because they are inlined at build time.']),
            'After fixing, re-run this diagnostic.',
          ],
    });
  });
}
