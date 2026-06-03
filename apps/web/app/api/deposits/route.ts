// Built by Anointed Coder.
//
// User-facing deposit submission. Body:
//   { amount, method, transactionId, proofUrl? }
// Writes a Deposit row with status=pending. The admin queue at
// /admin/deposits picks it up; approval credits the wallet and runs
// the lottery + bonus + affiliate hooks (see
// /api/admin/deposits/[id]/approve).
//
// M4 Phase C additions:
//   - Computes the deposit-bonus-tier preview at submit time and
//     snapshots bonusPercentage + bonusAmount on the row so the
//     admin can see what the player was promised even if the tier
//     definitions change between submit and approval.
//   - proofUrl is now validated to start with /uploads/ so the form
//     cannot inject an off-site URL into the admin review.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { pickBestTier } from '@/lib/bonuses/deposit-tiers';

const schema = z.object({
  amount: z.coerce.number().min(100).max(500_000),
  method: z.string().trim().min(1).max(60),
  transactionId: z.string().trim().min(6).max(64),
  proofUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .nullable()
    .refine((v) => v == null || v === '' || v.startsWith('/uploads/'), {
      message: 'proofUrl must be a path served from /uploads/',
    }),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-submit:${session.sub}`, 5, 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const preview = await pickBestTier(parsed.data.amount).catch(() => ({
      tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: parsed.data.amount,
    }));

    const deposit = await db.deposit.create({
      data: {
        userId: session.sub,
        amount: parsed.data.amount,
        method: parsed.data.method,
        transactionId: parsed.data.transactionId,
        proofUrl: parsed.data.proofUrl ?? null,
        status: 'pending',
        bonusPercentage: preview.bonusPercentage > 0 ? new Prisma.Decimal(preview.bonusPercentage) : null,
        bonusAmount: preview.bonusAmount > 0 ? new Prisma.Decimal(preview.bonusAmount) : null,
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
        hasProof: Boolean(parsed.data.proofUrl),
        promisedBonusPercentage: preview.bonusPercentage,
        promisedBonusAmount: preview.bonusAmount,
        promisedTotalCredit: preview.totalCredit,
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
          bonusPercentage: deposit.bonusPercentage == null ? 0 : Number(deposit.bonusPercentage),
          bonusAmount: deposit.bonusAmount == null ? 0 : Number(deposit.bonusAmount),
          totalCredit: Number(deposit.amount) + (deposit.bonusAmount == null ? 0 : Number(deposit.bonusAmount)),
          proofUrl: deposit.proofUrl,
        },
      },
      201,
    );
  });
}
