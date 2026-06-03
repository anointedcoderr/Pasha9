// Built by Anointed Coder.
//
// GET   /api/admin/rewards-config   load check-in + spin config
// PATCH /api/admin/rewards-config   save partial updates
// Body shape: { checkIn?: Partial<CheckInConfig>, spin?: Partial<SpinConfig> }

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { loadCheckInConfig, loadSpinConfig, saveCheckInConfig, saveSpinConfig } from '@/lib/rewards/config';

const patchSchema = z.object({
  checkIn: z.object({
    enabled: z.boolean().optional(),
    autoCheckIn: z.boolean().optional(),
    titleEn: z.string().max(120).optional(),
    titleBn: z.string().max(120).optional(),
    bodyEn: z.string().max(1000).optional(),
    bodyBn: z.string().max(1000).optional(),
    dailyCoins: z.coerce.number().int().min(0).max(1_000_000).optional(),
    streakBonusDay7: z.coerce.number().int().min(0).max(1_000_000).optional(),
    minDepositRequirement: z.coerce.number().min(0).max(10_000_000).optional(),
    minBetRequirement: z.coerce.number().min(0).max(10_000_000).optional(),
    insufficientCoinsTextEn: z.string().max(200).optional(),
    insufficientCoinsTextBn: z.string().max(200).optional(),
  }).partial().optional(),
  spin: z.object({
    enabled: z.boolean().optional(),
    titleEn: z.string().max(120).optional(),
    titleBn: z.string().max(120).optional(),
    costPerSpinCoins: z.coerce.number().int().min(0).max(1_000_000).optional(),
    freeSpinsPerDay: z.coerce.number().int().min(0).max(100).optional(),
    defaultTurnoverX: z.coerce.number().min(0).max(50).optional(),
    rulesEn: z.string().max(2000).optional(),
    rulesBn: z.string().max(2000).optional(),
  }).partial().optional(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const [checkIn, spin] = await Promise.all([loadCheckInConfig(), loadSpinConfig()]);
    return jsonOk({ checkIn, spin });
  });
}

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const next: { checkIn?: unknown; spin?: unknown } = {};
    if (parsed.data.checkIn) next.checkIn = await saveCheckInConfig(parsed.data.checkIn);
    if (parsed.data.spin) next.spin = await saveSpinConfig(parsed.data.spin);

    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'REWARDS_CONFIG_PATCH', target: 'rewards-config' });
    return jsonOk(next);
  });
}
