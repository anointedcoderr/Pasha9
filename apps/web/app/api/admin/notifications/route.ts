// Built by Anointed Coder.
//
// GET  /api/admin/notifications        list recent notifications + recipient count
// POST /api/admin/notifications        send a notification to selected audience

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const AUDIENCE = ['all', 'active', 'depositors', 'selected'] as const;

const sendSchema = z.object({
  titleEn: z.string().trim().min(1).max(200),
  titleBn: z.string().trim().max(200).optional().nullable(),
  bodyEn: z.string().trim().max(2000).optional().nullable(),
  bodyBn: z.string().trim().max(2000).optional().nullable(),
  linkUrl: z.string().trim().max(500).optional().nullable(),
  imageUrl: z.string().trim().max(500).optional().nullable(),
  soundUrl: z.string().trim().max(500).optional().nullable(),
  priority: z.enum(['low', 'normal', 'high']).optional().default('normal'),
  audience: z.enum(AUDIENCE).default('all'),
  userIds: z.array(z.string().min(1).max(60)).max(2000).optional(),
});

async function resolveUserIds(audience: (typeof AUDIENCE)[number], selectedIds: string[] | undefined): Promise<string[]> {
  if (audience === 'selected') {
    if (!selectedIds || selectedIds.length === 0) return [];
    const rows = await db.user.findMany({ where: { id: { in: selectedIds } }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  if (audience === 'depositors') {
    const rows = await db.deposit.findMany({
      where: { status: 'approved' },
      distinct: ['userId'],
      select: { userId: true },
    });
    return rows.map((r) => r.userId);
  }
  if (audience === 'active') {
    const rows = await db.user.findMany({ where: { status: 'active' }, select: { id: true } });
    return rows.map((r) => r.id);
  }
  // all
  const rows = await db.user.findMany({ select: { id: true } });
  return rows.map((r) => r.id);
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const rows = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { recipients: true } } },
    });
    return jsonOk({
      notifications: rows.map((n) => ({
        id: n.id,
        titleEn: n.titleEn,
        titleBn: n.titleBn,
        bodyEn: n.bodyEn,
        bodyBn: n.bodyBn,
        linkUrl: n.linkUrl,
        imageUrl: n.imageUrl,
        soundUrl: n.soundUrl,
        priority: n.priority,
        status: n.status,
        audience: n.audience,
        createdAt: n.createdAt,
        recipientCount: n._count.recipients,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = sendSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const userIds = await resolveUserIds(data.audience, data.userIds);
    if (userIds.length === 0) {
      return jsonError(409, 'EMPTY_AUDIENCE', 'No users matched the selected audience.');
    }

    const notification = await db.$transaction(async (tx) => {
      const created = await tx.notification.create({
        data: {
          titleEn: data.titleEn,
          titleBn: data.titleBn ?? null,
          bodyEn: data.bodyEn ?? null,
          bodyBn: data.bodyBn ?? null,
          linkUrl: data.linkUrl ?? null,
          imageUrl: data.imageUrl ?? null,
          soundUrl: data.soundUrl ?? null,
          priority: data.priority,
          status: 'sent',
          audience: data.audience,
          createdById: session.sub,
        },
      });

      // Bulk-create recipient rows. Chunk to keep the IN-clause SQL
      // size predictable on Postgres.
      const CHUNK = 500;
      for (let i = 0; i < userIds.length; i += CHUNK) {
        const slice = userIds.slice(i, i + CHUNK);
        await tx.notificationRecipient.createMany({
          data: slice.map((uid) => ({
            notificationId: created.id,
            userId: uid,
            deliveredAt: new Date(),
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'NOTIFICATION_SEND',
      target: notification.id,
      detail: notification.titleEn,
      meta: {
        audience: data.audience,
        recipientCount: userIds.length,
      } as Prisma.JsonObject,
    });

    return jsonOk({
      ok: true,
      notificationId: notification.id,
      recipientCount: userIds.length,
    });
  });
}
