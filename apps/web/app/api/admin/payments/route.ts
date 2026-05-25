// Built by Anointed Coder.
//
// Admin payments overview. Returns every provider, its admin-config
// status (live / requires_credentials / disabled / manual), and the
// SystemSetting field schema the admin UI uses to render credential
// inputs. Secret values are returned masked.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { listProviderSummaries } from '@/lib/payments/registry';

function maskSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}${'*'.repeat(Math.max(0, value.length - 4))}${value.slice(-2)}`;
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');

    const summaries = await listProviderSummaries();

    // Build a flat list of all SystemSetting keys this page reads/writes
    // so the UI can show current values without a per-provider fetch.
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
