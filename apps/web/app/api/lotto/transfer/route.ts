// Built by Anointed Coder.
//
// M2F user-facing lotto wallet transfer. Moves an amount from
// Wallet.lottoBalance to Wallet.balance in a single transaction.
// Once funds are in the main wallet the existing M2C /withdraw
// pipeline handles the actual payout (bKash / Nagad / Rocket /
// bank).
//
// Rate-limited to 5 transfers per minute per user. Min 100 BDT
// (MIN_LOTTO_TRANSFER in the engine).

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { transferLottoToMain, MIN_LOTTO_TRANSFER } from '@/lib/lotto/transfer';

const schema = z.object({
  amount: z.coerce.number().min(1).max(10_000_000),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`lotto-transfer:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const result = await transferLottoToMain(session.sub, parsed.data.amount);
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'LOTTO_TRANSFER',
        target: result.transactionId,
        meta: {
          amount: result.amount,
          newLottoBalance: result.newLottoBalance,
          newMainBalance: result.newMainBalance,
        },
      });
      return jsonOk({ ok: true, ...result }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const known: Record<string, { status: number; message: string }> = {
        AMOUNT_INVALID: { status: 400, message: 'Amount must be greater than zero.' },
        BELOW_MIN: { status: 400, message: `Minimum transfer is ${MIN_LOTTO_TRANSFER} BDT.` },
        WALLET_NOT_FOUND: { status: 404, message: 'Wallet not found.' },
        INSUFFICIENT_LOTTO_BALANCE: { status: 400, message: 'Lotto balance is lower than the requested amount.' },
      };
      const knownErr = known[msg];
      if (knownErr) return jsonError(knownErr.status, msg, knownErr.message);
      console.error('[lotto-transfer] unexpected', err);
      return jsonError(500, 'TRANSFER_FAILED', msg);
    }
  });
}
