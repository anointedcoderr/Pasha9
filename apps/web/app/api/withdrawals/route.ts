// Built by Anointed Coder.
//
// User-facing withdrawal submission. Signed-in user posts:
//   { amount, method, accountNumber, accountName }
// We write a Withdrawal row with status="pending". Admin then approves
// in /admin/withdrawals which deducts the wallet (see
// /api/admin/withdrawals/[id]/approve). No payout-gateway automation in
// M1 - this is the manual flow the brief asks for.
//
// The submission also requires sufficient (non-locked) wallet balance,
// otherwise it 400s with INSUFFICIENT_FUNDS so the user sees an
// actionable error rather than a queued request that will be rejected
// later.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  amount: z.coerce.number().min(500).max(200_000),
  method: z.string().trim().min(1).max(60),
  accountNumber: z.string().trim().min(6).max(40),
  accountName: z.string().trim().min(2).max(60),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireUser();

    const limit = rateLimit(`withdraw-submit:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const wallet = await db.wallet.findUnique({ where: { userId: session.sub } });
    const available = wallet ? Number(wallet.balance) - Number(wallet.lockedBalance) : 0;
    if (available < parsed.data.amount) {
      return jsonError(400, 'INSUFFICIENT_FUNDS', 'Withdrawable balance is lower than the requested amount.');
    }

    const withdrawal = await db.withdrawal.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: parsed.data.method,
        accountNumber: parsed.data.accountNumber,
        accountName: parsed.data.accountName,
        status: 'pending',
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'WITHDRAWAL_SUBMIT',
      target: withdrawal.id,
      meta: {
        amount: Number(parsed.data.amount),
        method: parsed.data.method,
      },
    });

    return jsonOk(
      {
        withdrawal: {
          id: withdrawal.id,
          amount: Number(withdrawal.amount),
          method: withdrawal.method,
          accountNumber: withdrawal.accountNumber,
          accountName: withdrawal.accountName,
          status: withdrawal.status,
          createdAt: withdrawal.createdAt,
        },
      },
      201,
    );
  });
}
