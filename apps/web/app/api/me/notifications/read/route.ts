// Built by Anointed Coder.
//
// POST /api/me/notifications/read
// Body:
//   { recipientId: "..." }  marks a single notification read
//   { all: true }           marks every unread notification read

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const schema = z.union([
  z.object({ recipientId: z.string().min(1).max(60) }),
  z.object({ all: z.literal(true) }),
]);

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const now = new Date();

    if ('all' in parsed.data) {
      const result = await db.notificationRecipient.updateMany({
        where: { userId: session.sub, readAt: null },
        data: { readAt: now },
      });
      return jsonOk({ ok: true, updated: result.count });
    }

    const recipient = await db.notificationRecipient.findUnique({
      where: { id: parsed.data.recipientId },
    });
    if (!recipient || recipient.userId !== session.sub) return jsonError(404, 'NOT_FOUND');
    if (recipient.readAt) return jsonOk({ ok: true, alreadyRead: true });

    await db.notificationRecipient.update({
      where: { id: recipient.id },
      data: { readAt: now },
    });

    return jsonOk({ ok: true });
  });
}
