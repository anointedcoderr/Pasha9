// Built by Anointed Coder.
//
// PATCH  /api/admin/sports-events/[id]   update one
// DELETE /api/admin/sports-events/[id]   delete one

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const SPORT_TYPES = ['cricket', 'football', 'tennis', 'basketball', 'esports', 'other'] as const;
const STATUSES = ['upcoming', 'live', 'ended'] as const;

const patchSchema = z.object({
  sportType: z.enum(SPORT_TYPES).optional(),
  status: z.enum(STATUSES).optional(),
  leagueNameEn: z.string().trim().min(1).max(160).optional(),
  leagueNameBn: z.string().trim().max(160).nullable().optional(),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().nullable().optional(),
  teamAName: z.string().trim().min(1).max(120).optional(),
  teamAShortName: z.string().trim().max(20).nullable().optional(),
  teamALogoUrl: z.string().trim().max(500).nullable().optional(),
  teamBName: z.string().trim().min(1).max(120).optional(),
  teamBShortName: z.string().trim().max(20).nullable().optional(),
  teamBLogoUrl: z.string().trim().max(500).nullable().optional(),
  providerName: z.string().trim().max(80).nullable().optional(),
  providerEventId: z.string().trim().max(100).nullable().optional(),
  deepLinkUrl: z.string().trim().max(800).nullable().optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const existing = await db.sportsEvent.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const d = parsed.data;
    const updated = await db.sportsEvent.update({
      where: { id: params.id },
      data: {
        ...(d.sportType !== undefined ? { sportType: d.sportType } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        ...(d.leagueNameEn !== undefined ? { leagueNameEn: d.leagueNameEn } : {}),
        ...(d.leagueNameBn !== undefined ? { leagueNameBn: d.leagueNameBn } : {}),
        ...(d.startsAt !== undefined ? { startsAt: new Date(d.startsAt) } : {}),
        ...(d.endsAt !== undefined ? { endsAt: d.endsAt ? new Date(d.endsAt) : null } : {}),
        ...(d.teamAName !== undefined ? { teamAName: d.teamAName } : {}),
        ...(d.teamAShortName !== undefined ? { teamAShortName: d.teamAShortName } : {}),
        ...(d.teamALogoUrl !== undefined ? { teamALogoUrl: d.teamALogoUrl } : {}),
        ...(d.teamBName !== undefined ? { teamBName: d.teamBName } : {}),
        ...(d.teamBShortName !== undefined ? { teamBShortName: d.teamBShortName } : {}),
        ...(d.teamBLogoUrl !== undefined ? { teamBLogoUrl: d.teamBLogoUrl } : {}),
        ...(d.providerName !== undefined ? { providerName: d.providerName } : {}),
        ...(d.providerEventId !== undefined ? { providerEventId: d.providerEventId } : {}),
        ...(d.deepLinkUrl !== undefined ? { deepLinkUrl: d.deepLinkUrl } : {}),
        ...(d.sortOrder !== undefined ? { sortOrder: d.sortOrder } : {}),
        ...(d.isActive !== undefined ? { isActive: d.isActive } : {}),
      },
    });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SPORTS_EVENT_PATCH',
      target: updated.id,
      detail: `${updated.leagueNameEn}: ${updated.teamAName} vs ${updated.teamBName}`,
    });
    return jsonOk({ event: updated });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('homepage.write');
    const existing = await db.sportsEvent.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    await db.sportsEvent.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SPORTS_EVENT_DELETE',
      target: params.id,
      detail: existing.leagueNameEn,
    });
    return jsonOk({ ok: true });
  });
}
