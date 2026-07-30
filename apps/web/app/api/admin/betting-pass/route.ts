// Built by Anointed Coder.
//
// GET  /api/admin/betting-pass   list rules + config + recent claims
// POST /api/admin/betting-pass   create a tier rule
// PUT  /api/admin/betting-pass   save runtime config (multipliers / season / on/off)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { loadBettingPassConfig, saveBettingPassConfig } from '@/lib/betting-pass/config';

const ruleSchema = z.object({
  tier: z.number().int().min(0).max(100),
  nameEn: z.string().trim().min(1).max(80),
  nameBn: z.string().trim().max(80).optional().nullable(),
  descriptionEn: z.string().trim().max(400).optional().nullable(),
  descriptionBn: z.string().trim().max(400).optional().nullable(),
  iconUrl: z.string().trim().max(500).optional().nullable(),
  showCrest: z.boolean().optional().default(true),
  pointsRequired: z.number().int().min(0).max(10_000_000),
  rewardKind: z.enum(['coins', 'bonus', 'freebet', 'physical', 'bdt_balance']).default('coins'),
  rewardAmount: z.number().min(0).max(10_000_000),
  turnoverX: z.number().min(0).max(50).optional().default(0),
  bonusRuleId: z.string().trim().max(60).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

const configSchema = z.object({
  enabled: z.boolean(),
  pointsPerBdtDeposit: z.number().min(0).max(1000),
  pointsPerBdtBet: z.number().min(0).max(1000),
  seasonKey: z.string().trim().min(1).max(40),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('rewards.write');
    const [config, rules, recentClaims, recentEvents] = await Promise.all([
      loadBettingPassConfig(),
      db.bettingPassRule.findMany({ orderBy: { pointsRequired: 'asc' } }),
      db.bettingPassClaim.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { username: true, phone: true } } },
      }),
      db.bettingPassEvent.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { username: true } } },
      }),
    ]);

    return jsonOk({
      config,
      rules: rules.map((r) => ({
        ...r,
        pointsRequired: r.pointsRequired,
        rewardAmount: Number(r.rewardAmount),
        turnoverX: Number(r.turnoverX ?? 0),
      })),
      recentClaims: recentClaims.map((c) => ({
        id: c.id,
        userId: c.userId,
        username: c.user?.username ?? null,
        phone: c.user?.phone ?? null,
        ruleId: c.ruleId,
        tier: c.tier,
        rewardKind: c.rewardKind,
        rewardAmount: Number(c.rewardAmount),
        status: c.status,
        createdAt: c.createdAt,
      })),
      recentEvents: recentEvents.map((e) => ({
        id: e.id,
        userId: e.userId,
        username: e.user?.username ?? null,
        source: e.source,
        sourceId: e.sourceId,
        points: Number(e.points),
        createdAt: e.createdAt,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = ruleSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const dup = await db.bettingPassRule.findUnique({ where: { tier: parsed.data.tier } });
    if (dup) return jsonError(409, 'DUPLICATE_TIER', `Tier ${parsed.data.tier} already exists.`);

    const rule = await db.bettingPassRule.create({
      data: {
        tier: parsed.data.tier,
        nameEn: parsed.data.nameEn,
        nameBn: parsed.data.nameBn ?? null,
        descriptionEn: parsed.data.descriptionEn ?? null,
        descriptionBn: parsed.data.descriptionBn ?? null,
        iconUrl: parsed.data.iconUrl ?? null,
        showCrest: parsed.data.showCrest ?? true,
        pointsRequired: parsed.data.pointsRequired,
        rewardKind: parsed.data.rewardKind,
        rewardAmount: parsed.data.rewardAmount,
        turnoverX: parsed.data.turnoverX ?? 0,
        bonusRuleId: parsed.data.bonusRuleId ?? null,
        isActive: parsed.data.isActive ?? true,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_RULE_CREATE',
      target: rule.id,
      meta: { tier: rule.tier, name: rule.nameEn, pointsRequired: rule.pointsRequired },
    });

    return jsonOk({ rule }, 201);
  });
}

export async function PUT(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const body = await req.json().catch(() => ({}));
    const parsed = configSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    await saveBettingPassConfig(parsed.data);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'BETTING_PASS_CONFIG_SAVE',
      target: 'betting_pass_config_v1',
      meta: parsed.data,
    });

    return jsonOk({ config: parsed.data });
  });
}
