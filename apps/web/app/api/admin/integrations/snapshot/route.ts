// Built by Anointed Coder.
//
// M2L Provider Management Console snapshot. One call returns the
// state of every external integration on the platform:
//   - inbound payment adapters (M2B)
//   - outbound payout adapters (M2C)
//   - SMS adapters + active provider key (M2I)
//   - tracking platforms (M2I)
//   - lotto cron + recovery cron (CRON_SECRET env)
//   - security (totp counts, IP block count)
//
// Read-only: no credential values are returned. The page deep-links
// to the existing per-area admin pages for editing.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listProviderSummaries } from '@/lib/payments/registry';
import { listPayoutSummaries } from '@/lib/payouts/registry';
import { listSmsAdapters } from '@/lib/sms/registry';
import { platformsStatus } from '@/lib/tracking/dispatcher';

const PAYMENT_GATEWAY_HREF = '/admin/payments';
const PAYOUT_GATEWAY_HREF = '/admin/payouts';
const NOTIFICATIONS_HREF = '/admin/notifications';
const SECURITY_HREF = '/admin/security';
const LOTTO_HREF = '/admin/lotto';
const RECOVERY_HREF = '/admin/recovery';
const PAYMENT_METHODS_HREF = '/admin/payment-methods';

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('activity.read');

    // Load every snapshot in parallel. Each helper is shaped slightly
    // differently because each subsystem evolved at its own pace; we
    // normalise them here so the page renders one consistent card grid.
    const [
      payments,
      payouts,
      smsAdapters,
      trackingPlatforms,
      smsProviderRow,
      ipBlockCount,
      totpEnabledCount,
      activeStaffCount,
      recentEdits,
    ] = await Promise.all([
      listProviderSummaries(),
      listPayoutSummaries(),
      Promise.resolve(listSmsAdapters().map((a) => a.describe())),
      platformsStatus(),
      db.systemSetting.findUnique({ where: { key: 'sms_provider' }, select: { value: true } }),
      db.ipBlockRule.count(),
      db.user.count({ where: { totpEnabled: true } }),
      db.user.count({ where: { role: { key: { in: ['super_admin', 'admin', 'staff'] } }, status: 'active' } }),
      db.activityLog.findMany({
        where: {
          action: {
            in: [
              'PAYMENT_SETTINGS_UPDATE',
              'PAYOUT_SETTINGS_UPDATE',
              'NOTIFICATIONS_SETTINGS_UPDATE',
              'IP_BLOCK_ADD',
              'IP_BLOCK_REMOVE',
              'TOTP_ENABLE',
              'TOTP_DISABLE',
              'PAYMENT_METHOD_CREATE',
              'PAYMENT_METHOD_UPDATE',
              'PAYMENT_METHOD_DELETE',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { actor: { select: { username: true } } },
      }),
    ]);

    const activeSmsKey = (smsProviderRow?.value ?? 'manual').trim() || 'manual';
    const cronSecretConfigured = Boolean(process.env.CRON_SECRET?.trim());

    return jsonOk({
      categories: {
        // Each category surface is normalised to { key, label, status,
        // description, configureHref, testHref }. status is one of
        // 'live' | 'requires_credentials' | 'manual' | 'disabled'.
        payments: payments.map((p) => ({
          key: p.key,
          label: p.label,
          status: p.status,
          description: p.description,
          configureHref: PAYMENT_GATEWAY_HREF,
          fieldCount: p.fields.length,
        })),
        payouts: payouts.map((p) => ({
          key: p.key,
          label: p.label,
          status: p.status,
          description: p.description,
          configureHref: PAYOUT_GATEWAY_HREF,
          fieldCount: p.fields.length,
        })),
        sms: smsAdapters.map((a) => ({
          key: a.key,
          label: a.label,
          status: a.status,
          description: a.description,
          configureHref: NOTIFICATIONS_HREF,
          fieldCount: a.settingKeys.length,
          isActive: a.key === activeSmsKey,
        })),
        tracking: trackingPlatforms.map((p) => ({
          key: p.key,
          label: p.label,
          status: p.live ? 'live' : 'requires_credentials',
          description: `Settings: ${p.settingKeys.join(', ')}`,
          configureHref: NOTIFICATIONS_HREF,
          fieldCount: p.settingKeys.length,
        })),
      },
      platform: {
        activeSmsProvider: activeSmsKey,
        cronSecretConfigured,
        cronRoutes: [
          { key: 'lotto-rollover', label: 'Lotto rollover (M2F)', path: '/api/cron/lotto-rollover', requiresSecret: true, deepLink: LOTTO_HREF },
          { key: 'recovery-sweep', label: 'Recovery sweep (M2H)', path: '/api/cron/recovery-sweep', requiresSecret: true, deepLink: RECOVERY_HREF },
        ],
        paymentMethodsHref: PAYMENT_METHODS_HREF,
        securityHref: SECURITY_HREF,
      },
      security: {
        ipBlockCount,
        totpEnabledUserCount: totpEnabledCount,
        activeStaffCount,
      },
      recentEdits: recentEdits.map((e) => ({
        id: e.id,
        action: e.action,
        target: e.target,
        detail: e.detail,
        actorUsername: e.actor?.username ?? null,
        actorRole: e.actorRole,
        createdAt: e.createdAt,
      })),
    });
  });
}
