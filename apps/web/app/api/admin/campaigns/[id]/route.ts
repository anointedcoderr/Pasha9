// Built by Anointed Coder.
//
// GET    /api/admin/campaigns/[id]   campaign detail + last 100 recipients
// DELETE /api/admin/campaigns/[id]   delete a draft campaign

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.read');
    const campaign = await db.campaign.findUnique({
      where: { id: params.id },
      include: {
        recipients: {
          orderBy: { createdAt: 'desc' },
          take: 100,
          include: { user: { select: { id: true, username: true } } },
        },
        _count: { select: { recipients: true } },
      },
    });
    if (!campaign) return jsonError(404, 'NOT_FOUND');

    return jsonOk({
      campaign: {
        id: campaign.id,
        channel: campaign.channel,
        title: campaign.title,
        subject: campaign.subject,
        body: campaign.body,
        audience: campaign.audience,
        status: campaign.status,
        providerStatus: campaign.providerStatus,
        recipientCount: campaign.recipientCount,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        createdAt: campaign.createdAt,
        sentAt: campaign.sentAt,
        actualRecipientCount: campaign._count.recipients,
      },
      recipients: campaign.recipients.map((r) => ({
        id: r.id,
        userId: r.userId,
        username: r.user?.username ?? null,
        phone: r.phone,
        email: r.email,
        status: r.status,
        providerMessageId: r.providerMessageId,
        error: r.error,
        sentAt: r.sentAt,
        createdAt: r.createdAt,
      })),
    });
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('settings.write');
    const existing = await db.campaign.findUnique({ where: { id: params.id } });
    if (!existing) return jsonError(404, 'NOT_FOUND');
    if (existing.status !== 'draft' && existing.status !== 'provider_setup_required') {
      return jsonError(409, 'CANNOT_DELETE', 'Only draft or provider-setup-required campaigns can be deleted.');
    }
    await db.campaign.delete({ where: { id: params.id } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'CAMPAIGN_DELETE',
      target: params.id,
      detail: existing.title,
    });
    return jsonOk({ ok: true });
  });
}
