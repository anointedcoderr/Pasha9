// Built by Anointed Coder.
//
// POST   /api/admin/push-devices   register an admin phone's FCM token
// DELETE /api/admin/push-devices   deactivate by token
//
// Staff-only. The token is issued by firebase/messaging getToken() on
// the admin's phone. One row per token (token is unique); re-registering
// the same token just refreshes ownership + lastSeenAt.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const registerSchema = z.object({
  token: z.string().min(20).max(4096),
  userAgent: z.string().max(500).optional().nullable(),
  deviceLabel: z.string().max(120).optional().nullable(),
});

const unregisterSchema = z.object({
  token: z.string().min(20).max(4096),
});

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireStaff();
    const body = await req.json().catch(() => ({}));
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const data = parsed.data;

    const row = await db.adminPushDevice.upsert({
      where: { token: data.token },
      create: {
        userId: session.sub,
        token: data.token,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
      },
      update: {
        userId: session.sub,
        userAgent: data.userAgent ?? null,
        deviceLabel: data.deviceLabel ?? null,
        isActive: true,
        lastSeenAt: new Date(),
        failedAt: null,
        failureReason: null,
      },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'ADMIN_PUSH_SUBSCRIBE',
      target: row.id,
      meta: { userAgent: data.userAgent ?? null },
    });

    return jsonOk({ ok: true, deviceId: row.id });
  });
}

export async function DELETE(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireStaff();
    const body = await req.json().catch(() => ({}));
    const parsed = unregisterSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION');

    const row = await db.adminPushDevice.findUnique({ where: { token: parsed.data.token } });
    if (!row || row.userId !== session.sub) return jsonOk({ ok: true });

    await db.adminPushDevice.update({
      where: { token: parsed.data.token },
      data: { isActive: false },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'ADMIN_PUSH_UNSUBSCRIBE',
      target: row.id,
    });

    return jsonOk({ ok: true });
  });
}
