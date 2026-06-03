// Built by Anointed Coder.
//
// GET /api/admin/transactions?type=&q=&take=
//
// Platform-wide wallet ledger for the admin Transaction Logs page.
// Reads the canonical Transaction table joined with the user. Filters
// by type or by free-text search (matches username, phone or
// reference). Capped at 500 rows per call.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

const ALLOWED_TYPES = new Set(['deposit', 'withdraw', 'bonus', 'referral', 'bet', 'win', 'adjust']);

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const url = new URL(req.url);
    const typeParam = url.searchParams.get('type');
    const q = (url.searchParams.get('q') ?? '').trim();
    const take = Math.min(500, Math.max(1, Number(url.searchParams.get('take') ?? 200) || 200));

    const where: Prisma.TransactionWhereInput = {};
    if (typeParam && ALLOWED_TYPES.has(typeParam)) {
      where.type = typeParam as Prisma.EnumTxTypeFilter['equals'];
    }
    if (q) {
      where.OR = [
        { reference: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { user: { username: { contains: q, mode: 'insensitive' } } },
        { user: { phone: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const rows = await db.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { id: true, username: true, phone: true } } },
    });

    return jsonOk({
      transactions: rows.map((t) => ({
        id: t.id,
        userId: t.userId,
        username: t.user.username,
        phone: t.user.phone,
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        reference: t.reference,
        description: t.description,
        createdAt: t.createdAt,
      })),
    });
  });
}
