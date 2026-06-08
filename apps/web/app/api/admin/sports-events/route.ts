// Built by Anointed Coder.
//
// GET  /api/admin/sports-events    list
// POST /api/admin/sports-events    create

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const SPORT_TYPES = ['cricket', 'football', 'tennis', 'basketball', 'esports', 'other'] as const;
const STATUSES = ['upcoming', 'live', 'ended'] as const;

const createSchema = z.object({
  sportType: z.enum(SPORT_TYPES).default('cricket'),
  status: z.enum(STATUSES).default('upcoming'),
  leagueNameEn: z.string().trim().min(1).max(160),
  leagueNameBn: z.string().trim().max(160).optional().nullable(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime().optional().nullable(),
  teamAName: z.string().trim().min(1).max(120),
  teamAShortName: z.string().trim().max(20).optional().nullable(),
  teamALogoUrl: z.string().trim().max(500).optional().nullable(),
  teamBName: z.string().trim().min(1).max(120),
  teamBShortName: z.string().trim().max(20).optional().nullable(),
  teamBLogoUrl: z.string().trim().max(500).optional().nullable(),
  providerName: z.string().trim().max(80).optional().nullable(),
  providerEventId: z.string().trim().max(100).optional().nullable(),
  deepLinkUrl: z.string().trim().max(800).optional().nullable(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('homepage.write');
    const rows = await db.sportsEvent.findMany({
      orderBy: [{ isActive: 'desc' }, { status: 'asc' }, { startsAt: 'asc' }, { sortOrder: 'asc' }],
      take: 200,
    });
    return jsonOk({ events: rows });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const d = parsed.data;
    const created = await db.sportsEvent.create({
      data: {
        sportType: d.sportType,
        status: d.status,
        leagueNameEn: d.leagueNameEn,
        leagueNameBn: d.leagueNameBn ?? null,
        startsAt: new Date(d.startsAt),
        endsAt: d.endsAt ? new Date(d.endsAt) : null,
        teamAName: d.teamAName,
        teamAShortName: d.teamAShortName ?? null,
        teamALogoUrl: d.teamALogoUrl ?? null,
        teamBName: d.teamBName,
        teamBShortName: d.teamBShortName ?? null,
        teamBLogoUrl: d.teamBLogoUrl ?? null,
        providerName: d.providerName ?? null,
        providerEventId: d.providerEventId ?? null,
        deepLinkUrl: d.deepLinkUrl ?? null,
        sortOrder: d.sortOrder,
        isActive: d.isActive,
        source: 'manual',
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SPORTS_EVENT_CREATE',
      target: created.id,
      detail: `${d.leagueNameEn}: ${d.teamAName} vs ${d.teamBName}`,
    });
    return jsonOk({ event: created }, 201);
  });
}
