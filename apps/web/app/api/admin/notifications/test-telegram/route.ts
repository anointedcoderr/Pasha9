// Built by Anointed Coder.
//
// Admin "send a test Telegram message" button. Uses the saved bot
// token + chat id and sends a short bilingual line so the operator can
// confirm the group wiring before real deposit / withdrawal alerts
// depend on it. Runs even while the alerts toggle is still off, so the
// setup can be verified first and enabled second.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { sendTelegramAlert, escapeTelegramHtml, publicSiteBaseUrl } from '@/lib/telegram/notify';

export async function POST() {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');

    const text = [
      `<b>${escapeTelegramHtml('টেলিগ্রাম অ্যালার্ট পরীক্ষা সফল হয়েছে।')}</b>`,
      'Pasha9 admin alert test. If you can read this, Telegram alerts are wired up correctly.',
      `${publicSiteBaseUrl()}/admin/notifications`,
    ].join('\n');

    const result = await sendTelegramAlert(text, { ignoreEnabled: true });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: result.ok ? 'NOTIFICATIONS_TEST_TELEGRAM_OK' : 'NOTIFICATIONS_TEST_TELEGRAM_FAIL',
      detail: result.ok ? 'sent' : (result.error ?? 'unknown error'),
      meta: { ok: result.ok, skipped: result.skipped ?? false },
    });

    return jsonOk({ result });
  });
}
