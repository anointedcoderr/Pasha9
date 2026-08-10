// Built by Anointed Coder.
//
// GET  /api/admin/registration-bonus   current configuration
// PUT  /api/admin/registration-bonus   save it
//
// Money rules, so every save is recorded against the staff member who made it.
// Turning the bonus on, raising the amount or lowering the deposit requirement
// all change what the platform gives away, and each needs to be answerable
// later.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import {
  REGISTRATION_BONUS_KEYS,
  loadRegistrationBonusConfig,
} from '@/lib/bonuses/registration';

const schema = z.object({
  enabled: z.boolean(),
  amount: z.coerce.number().min(0).max(1_000_000),
  maxWinning: z.coerce.number().min(0).max(100_000_000),
  requiredDepositPercent: z.coerce.number().min(0).max(1000),
  turnoverMultiplier: z.coerce.number().min(0).max(1000),
  // Comma separated game uids. Blank means every game counts.
  eligibleGames: z.string().max(4000).optional().default(''),
  lockWinnings: z.boolean(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const cfg = await loadRegistrationBonusConfig();
    return jsonOk({
      config: {
        enabled: cfg.enabled,
        amount: Number(cfg.amount),
        maxWinning: Number(cfg.maxWinning),
        requiredDepositPercent: Number(cfg.requiredDepositPercent),
        turnoverMultiplier: Number(cfg.turnoverMultiplier),
        eligibleGames: cfg.eligibleGames.join(', '),
        lockWinnings: cfg.lockWinnings,
      },
    });
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const v = parsed.data;

    const K = REGISTRATION_BONUS_KEYS;
    const updates: Array<[string, string, string]> = [
      [K.enabled, v.enabled ? 'true' : 'false', 'boolean'],
      [K.amount, String(v.amount), 'number'],
      [K.maxWinning, String(v.maxWinning), 'number'],
      [K.requiredDepositPercent, String(v.requiredDepositPercent), 'number'],
      [K.turnoverMultiplier, String(v.turnoverMultiplier), 'number'],
      [K.eligibleGames, (v.eligibleGames ?? '').split(',').map((s) => s.trim()).filter(Boolean).join(','), 'string'],
      [K.lockWinnings, v.lockWinnings ? 'true' : 'false', 'boolean'],
    ];

    await db.$transaction(
      updates.map(([key, value, type]) =>
        db.systemSetting.upsert({
          where: { key },
          update: { value, type, category: 'general' },
          create: { key, value, type, category: 'general' },
        }),
      ),
    );

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'REGISTRATION_BONUS_UPDATE',
      detail: v.enabled
        ? `on, amount ${v.amount}, unlock at ${v.requiredDepositPercent}% deposit, max win ${v.maxWinning}`
        : 'off',
      meta: { ...v },
    });

    return jsonOk({ ok: true, config: v });
  });
}
