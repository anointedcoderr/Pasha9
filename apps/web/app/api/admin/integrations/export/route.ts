// Built by Anointed Coder.
//
// M2L handover CSV. One row per provider across every category,
// suitable for a client lock-down audit. No credential values are
// included - only status, label, deep-link, field count, last edit.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { listProviderSummaries } from '@/lib/payments/registry';
import { listPayoutSummaries } from '@/lib/payouts/registry';
import { listSmsAdapters } from '@/lib/sms/registry';
import { platformsStatus } from '@/lib/tracking/dispatcher';
import { toCsv, csvResponse } from '@/lib/reports/csv';

interface Row extends Record<string, unknown> {
  category: string;
  provider: string;
  label: string;
  status: string;
  field_count: number;
  configure_url: string;
  notes: string;
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('activity.read');

    const [payments, payouts, smsAdapters, trackingPlatforms, smsProviderRow] = await Promise.all([
      listProviderSummaries(),
      listPayoutSummaries(),
      Promise.resolve(listSmsAdapters().map((a) => a.describe())),
      platformsStatus(),
      db.systemSetting.findUnique({ where: { key: 'sms_provider' }, select: { value: true } }),
    ]);
    const activeSms = (smsProviderRow?.value ?? 'manual').trim() || 'manual';

    const rows: Row[] = [];
    for (const p of payments) {
      rows.push({
        category: 'payment_inbound',
        provider: p.key,
        label: p.label,
        status: String(p.status),
        field_count: p.fields.length,
        configure_url: '/admin/payments',
        notes: p.description,
      });
    }
    for (const p of payouts) {
      rows.push({
        category: 'payment_outbound',
        provider: p.key,
        label: p.label,
        status: String(p.status),
        field_count: p.fields.length,
        configure_url: '/admin/payouts',
        notes: p.description,
      });
    }
    for (const a of smsAdapters) {
      rows.push({
        category: 'sms',
        provider: a.key,
        label: a.label,
        status: a.status,
        field_count: a.settingKeys.length,
        configure_url: '/admin/notifications',
        notes: a.key === activeSms ? `ACTIVE provider . ${a.description}` : a.description,
      });
    }
    for (const t of trackingPlatforms) {
      rows.push({
        category: 'tracking',
        provider: t.key,
        label: t.label,
        status: t.live ? 'live' : 'requires_credentials',
        field_count: t.settingKeys.length,
        configure_url: '/admin/notifications',
        notes: `Settings: ${t.settingKeys.join(', ')}`,
      });
    }
    // Cron secret + security as informational rows.
    rows.push({
      category: 'cron',
      provider: 'cron_secret',
      label: 'CRON_SECRET env',
      status: process.env.CRON_SECRET?.trim() ? 'live' : 'requires_credentials',
      field_count: 1,
      configure_url: '/admin/lotto',
      notes: 'Required Bearer token for /api/cron/lotto-rollover + /api/cron/recovery-sweep. Set via .env on the VPS, not the admin UI.',
    });

    const stamp = new Date().toISOString().slice(0, 10);
    return csvResponse(`integrations_${stamp}.csv`, toCsv(rows, ['category', 'provider', 'label', 'status', 'field_count', 'configure_url', 'notes']));
  });
}
