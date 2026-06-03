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
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  amount: z.coerce.number().min(1).max(10_000_000),
  method: z.string().trim().min(1).max(60),
  accountNumber: z.string().trim().min(6).max(40),
  // Public form no longer collects accountName after the Babu88-style
  // redesign; we accept it when sent (admin tooling may still post it)
  // and fall back to "-" so the DB column and existing admin readers
  // stay populated.
  accountName: z.string().trim().max(60).optional().default('-'),
});

const DEFAULT_MIN = 500;
const DEFAULT_MAX = 200_000;

async function resolveGlobalLimits(): Promise<{ min: number; max: number }> {
  const rows = await db.systemSetting.findMany({
    where: { key: { in: ['withdrawal_min_amount', 'withdrawal_max_amount'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const min = Number(map.get('withdrawal_min_amount') ?? DEFAULT_MIN) || DEFAULT_MIN;
  const max = Number(map.get('withdrawal_max_amount') ?? DEFAULT_MAX) || DEFAULT_MAX;
  return { min, max };
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`withdraw-submit:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // Global admin-configurable limits live in SystemSetting.
    const { min: globalMin, max: globalMax } = await resolveGlobalLimits();
    if (parsed.data.amount < globalMin) {
      return jsonError(400, 'BELOW_MIN', `Minimum withdrawal is ${globalMin} BDT.`);
    }
    if (parsed.data.amount > globalMax) {
      return jsonError(400, 'ABOVE_MAX', `Maximum withdrawal is ${globalMax} BDT per request.`);
    }

    // Per-method limits live on PaymentMethod. If the user picked a
    // method name that maps to a real PaymentMethod row, enforce its
    // payoutEnabled flag + min/max. Backwards-compatible for the old
    // mock method names that have no row in DB yet.
    const method = await db.paymentMethod.findFirst({
      where: { name: parsed.data.method, status: 'active' },
      select: { name: true, payoutEnabled: true, minWithdrawal: true, maxWithdrawal: true },
    });
    if (method) {
      if (!method.payoutEnabled) {
        return jsonError(400, 'METHOD_PAYOUT_DISABLED', `${method.name} is not available for withdrawals right now.`);
      }
      const methodMin = method.minWithdrawal == null ? null : Number(method.minWithdrawal);
      const methodMax = method.maxWithdrawal == null ? null : Number(method.maxWithdrawal);
      if (methodMin != null && parsed.data.amount < methodMin) {
        return jsonError(400, 'METHOD_BELOW_MIN', `Minimum withdrawal via ${method.name} is ${methodMin} BDT.`);
      }
      if (methodMax != null && parsed.data.amount > methodMax) {
        return jsonError(400, 'METHOD_ABOVE_MAX', `Maximum withdrawal via ${method.name} is ${methodMax} BDT.`);
      }
    }

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
        events: {
          create: {
            kind: 'submitted',
            actorId: session.sub,
            actorRole: session.role,
            note: 'Submitted by user.',
          },
        },
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
