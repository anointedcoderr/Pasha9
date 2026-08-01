// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listPayoutSummaries } from '@/lib/payouts/registry';

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

export async function GET() {
  return withAuth(async () => {
    // View-only: was settings.write; see payments/route.ts for the same
    // reasoning. payments.read is the shared read code for the whole Payment
    // Providers section (payments, payouts, payment methods, reconciliation).
    await ensurePermission('payments.read');

    const summaries = await listPayoutSummaries();

    const allKeys = summaries.flatMap((p) => p.fields.map((f) => f.key));
    const rows = await db.systemSetting.findMany({ where: { key: { in: allKeys } } });
    const valueByKey = new Map<string, string>();
    for (const r of rows) valueByKey.set(r.key, r.value ?? '');

    return jsonOk({
      providers: summaries.map((p) => ({
        ...p,
        fields: p.fields.map((f) => ({
          ...f,
          value: f.kind === 'secret' ? maskSecret(valueByKey.get(f.key)) : (valueByKey.get(f.key) ?? ''),
          hasValue: !!(valueByKey.get(f.key) ?? '').trim(),
        })),
      })),
    });
  });
}
