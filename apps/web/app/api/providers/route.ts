// Built by Anointed Coder.
//
// Public list of active external providers. Used by the homepage
// and /games lobby to decide whether to render the live provider
// rail or the "Awaiting credentials" placeholder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.gameProvider.findMany({
    where: { status: 'active', providerKey: { not: null }, adapterKey: { not: null } },
    orderBy: { name: 'asc' },
    select: {
      id: true, name: true, providerKey: true, adapterKey: true,
      lastHealthCheckAt: true, lastHealthCheckOk: true, lastSyncAt: true,
      launchMinBalance: true,
    },
  });
  return jsonOk({
    providers: rows.map((r) => ({
      providerKey: r.providerKey ?? '',
      name: r.name,
      adapterKey: r.adapterKey ?? '',
      lastHealthCheckAt: r.lastHealthCheckAt,
      lastHealthCheckOk: r.lastHealthCheckOk,
      lastSyncAt: r.lastSyncAt,
      launchMinBalance: r.launchMinBalance ? Number(r.launchMinBalance) : 0,
    })),
  });
}
