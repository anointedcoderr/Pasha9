// Built by Anointed Coder.
//
// User-facing deposit submission. The signed-in user posts:
//   { amount, method, transactionId, proofUrl? }
// and we write a Deposit row with status="pending". The admin
// queue at /admin/deposits then picks it up; approval there credits
// the wallet and runs the lottery accrual (see
// /api/admin/deposits/[id]/approve).
//
// No live payment gateway is involved in M1 - this is the manual
// deposit flow the brief asks for.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { requireUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  method: z.string().trim().min(1).max(60),
  transactionId: z.string().trim().min(6).max(64),
  proofUrl: z.string().trim().max(500).optional().nullable(),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireUser();

    // Allow up to 5 submissions per minute per user; deposits are
    // typically infrequent so this is generous and still blocks
    // accidental double-submits and spam.
    const limit = rateLimit(`deposit-submit:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: parsed.data.method,
        transactionId: parsed.data.transactionId,
        proofUrl: parsed.data.proofUrl ?? null,
        status: 'pending',
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_SUBMIT',
      target: deposit.id,
      meta: {
        amount: Number(parsed.data.amount),
        method: parsed.data.method,
        transactionId: parsed.data.transactionId,
      },
    });

    return jsonOk(
      {
        deposit: {
          id: deposit.id,
          amount: Number(deposit.amount),
          method: deposit.method,
          transactionId: deposit.transactionId,
          status: deposit.status,
          createdAt: deposit.createdAt,
        },
      },
      201,
    );
  });
}
