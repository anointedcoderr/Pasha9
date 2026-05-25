// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('deposits.read');
    const url = new URL(req.url);
    const provider = url.searchParams.get('provider')?.trim();
    const status = url.searchParams.get('status')?.trim();
    const direction = url.searchParams.get('direction')?.trim();
    const take = Math.min(200, Number(url.searchParams.get('take') ?? 100));

    const where: {
      provider?: string;
      status?: string;
      direction?: string;
    } = {};
    if (provider) where.provider = provider;
    if (status) where.status = status;
    if (direction === 'inbound' || direction === 'outbound') where.direction = direction;

    const rows = await db.paymentGatewayTx.findMany({
      where,
      orderBy: { receivedAt: 'desc' },
      take,
    });

    return jsonOk({
      rows: rows.map((r) => ({
        id: r.id,
        provider: r.provider,
        direction: r.direction,
        providerTxId: r.providerTxId,
        depositId: r.depositId,
        withdrawalId: r.withdrawalId,
        userId: r.userId,
        amount: r.amount ? Number(r.amount) : null,
        currency: r.currency,
        status: r.status,
        signatureValid: r.signatureValid,
        note: r.note,
        receivedAt: r.receivedAt,
        processedAt: r.processedAt,
      })),
    });
  });
}
