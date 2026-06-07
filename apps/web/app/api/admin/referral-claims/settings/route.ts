// Built by Anointed Coder.
//
// PATCH /api/admin/referral-claims/settings
//
// Updates the SystemSetting rows that drive the referral claim flow:
//   referral_claim_cadence  weekly | monthly | manual | auto
//   referral_hold_days       integer >= 0
//   referral_turnover_x      integer >= 0 (0 = no gate)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings } from '@/lib/affiliate/balance';

const schema = z.object({
  cadence: z.enum(['weekly', 'monthly', 'manual', 'auto']).optional(),
  holdDays: z.coerce.number().int().min(0).max(180).optional(),
  turnoverX: z.coerce.number().min(0).max(50).optional(),
  firstDepositMinBdt: z.coerce.number().min(0).max(10_000_000).optional(),
  firstDepositRewardBdt: z.coerce.number().min(0).max(1_000_000).optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const settings = await loadReferralSettings();
    return jsonOk({ settings });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const claims = await getCurrentSession();
    if (!claims) return jsonError(401, 'UNAUTHENTICATED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const writes: Promise<unknown>[] = [];
    if (parsed.data.cadence !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'referral_claim_cadence' },
        update: { value: parsed.data.cadence, type: 'string' },
        create: { key: 'referral_claim_cadence', value: parsed.data.cadence, type: 'string' },
      }));
    }
    if (parsed.data.holdDays !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'referral_hold_days' },
        update: { value: String(parsed.data.holdDays), type: 'number' },
        create: { key: 'referral_hold_days', value: String(parsed.data.holdDays), type: 'number' },
      }));
    }
    if (parsed.data.turnoverX !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'referral_turnover_x' },
        update: { value: String(parsed.data.turnoverX), type: 'number' },
        create: { key: 'referral_turnover_x', value: String(parsed.data.turnoverX), type: 'number' },
      }));
    }
    if (parsed.data.firstDepositMinBdt !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'referral_first_deposit_min_bdt' },
        update: { value: String(parsed.data.firstDepositMinBdt), type: 'number' },
        create: { key: 'referral_first_deposit_min_bdt', value: String(parsed.data.firstDepositMinBdt), type: 'number' },
      }));
    }
    if (parsed.data.firstDepositRewardBdt !== undefined) {
      writes.push(db.systemSetting.upsert({
        where: { key: 'referral_first_deposit_reward_bdt' },
        update: { value: String(parsed.data.firstDepositRewardBdt), type: 'number' },
        create: { key: 'referral_first_deposit_reward_bdt', value: String(parsed.data.firstDepositRewardBdt), type: 'number' },
      }));
    }
    await Promise.all(writes);

    const settings = await loadReferralSettings();

    await recordActivity({
      actorId: claims.sub,
      actorRole: claims.role,
      action: 'REFERRAL_SETTINGS_UPDATE',
      target: 'system',
      meta: parsed.data,
    });

    return jsonOk({ settings });
  });
}
