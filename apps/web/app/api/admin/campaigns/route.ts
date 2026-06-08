// Built by Anointed Coder.
//
// GET  /api/admin/campaigns   list campaigns
// POST /api/admin/campaigns   create a campaign (draft state)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const AUDIENCE = ['all', 'active', 'depositors', 'with_phone', 'with_email', 'selected'] as const;
const CHANNEL = ['sms', 'email'] as const;

const createSchema = z.object({
  channel: z.enum(CHANNEL),
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(200).optional().nullable(),
  body: z.string().trim().min(1).max(10_000),
  audience: z.enum(AUDIENCE).default('all'),
  userIds: z.array(z.string().min(1).max(60)).max(5000).optional(),
});

function serialize(c: Awaited<ReturnType<typeof db.campaign.findMany>>[number] & { _count?: { recipients: number } }) {
  return {
    id: c.id,
    channel: c.channel,
    title: c.title,
    subject: c.subject,
    body: c.body,
    audience: c.audience,
    status: c.status,
    providerStatus: c.providerStatus,
    recipientCount: c.recipientCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    sentAt: c.sentAt,
    actualRecipientCount: c._count?.recipients ?? 0,
  };
}

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const rows = await db.campaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { _count: { select: { recipients: true } } },
    });
    return jsonOk({ campaigns: rows.map(serialize) });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const campaign = await db.$transaction(async (tx) => {
      const created = await tx.campaign.create({
        data: {
          channel: data.channel,
          title: data.title,
          subject: data.subject ?? null,
          body: data.body,
          audience: data.audience,
          status: 'draft',
          createdById: session.sub,
        },
      });

      if (data.audience === 'selected' && data.userIds && data.userIds.length > 0) {
        const users = await tx.user.findMany({
          where: { id: { in: data.userIds } },
          select: { id: true, phone: true, email: true },
        });
        if (users.length > 0) {
          await tx.campaignRecipient.createMany({
            data: users.map((u) => ({
              campaignId: created.id,
              userId: u.id,
              phone: u.phone ?? null,
              email: u.email ?? null,
              status: 'queued',
            })),
            skipDuplicates: true,
          });
          await tx.campaign.update({
            where: { id: created.id },
            data: { recipientCount: users.length },
          });
        }
      }

      return created;
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CAMPAIGN_CREATE',
      target: campaign.id,
      detail: `${campaign.channel}: ${campaign.title}`,
    });

    return jsonOk({ campaign: serialize(campaign) }, 201);
  });
}
