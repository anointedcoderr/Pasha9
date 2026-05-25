// Built by Anointed Coder.
//
// User-facing affiliate payout request. Posts amount + payout method
// + account details; engine reserves the matching commissions, the
// admin reviews + marks paid from /admin/affiliate (Payouts tab).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { requestPayout, getAffiliateBalance } from '@/lib/affiliate/engine';

const ALLOWED_METHODS = ['bkash', 'nagad', 'rocket', 'bank'] as const;

const schema = z.object({
  amount: z.coerce.number().min(1).max(10_000_000),
  method: z.enum(ALLOWED_METHODS as unknown as [string, ...string[]]),
  accountNumber: z.string().trim().min(6).max(40),
  accountName: z.string().trim().min(2).max(60),
});

const MIN_PAYOUT = 500;

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`affiliate-payout:${session.sub}`, 3, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const me = await db.user.findUnique({ where: { id: session.sub }, select: { isAffiliate: true } });
    if (!me?.isAffiliate) return jsonError(403, 'NOT_AFFILIATE');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    if (parsed.data.amount < MIN_PAYOUT) {
      return jsonError(400, 'BELOW_MIN', `Minimum payout is ${MIN_PAYOUT} BDT.`);
    }

    const balance = await getAffiliateBalance(session.sub);
    if (parsed.data.amount > balance.withdrawable) {
      return jsonError(400, 'INSUFFICIENT_BALANCE', `Withdrawable commission is ${balance.withdrawable} BDT.`);
    }

    try {
      const result = await requestPayout({
        affiliateId: session.sub,
        amount: parsed.data.amount,
        method: parsed.data.method,
        accountNumber: parsed.data.accountNumber,
        accountName: parsed.data.accountName,
      });

      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'AFFILIATE_PAYOUT_REQUEST',
        target: result.payoutId,
        meta: {
          amount: result.amount,
          method: parsed.data.method,
          commissionsReserved: result.reservedCommissionIds.length,
        },
      });

      return jsonOk({ payout: { id: result.payoutId, amount: result.amount, status: 'pending' } }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const known = ['AMOUNT_INVALID', 'INSUFFICIENT_BALANCE'];
      if (known.includes(msg)) return jsonError(400, msg);
      console.error('[affiliate-payout-request] failed', err);
      return jsonError(500, 'REQUEST_FAILED', msg);
    }
  });
}
