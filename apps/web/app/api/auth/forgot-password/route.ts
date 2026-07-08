// Built by Anointed Coder.
//
// POST /api/auth/forgot-password  Body: { identifier }
//
// Generic response: "If the account exists, a reset request has been
// created. Please contact support/admin to complete the reset."
// Never reveals whether the account exists. Creates a pending
// PasswordResetToken row when a match is found; admin reviews it from
// /admin/password-resets and approves to issue a one-time token.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { jsonOk, jsonError } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { notifyAdminsPasswordResetRequested } from '@/lib/notifications/notify';

const schema = z.object({
  identifier: z.string().trim().min(3).max(120),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!(await rateLimit(`forgot:${ip ?? 'anon'}`, 5, 60 * 60_000))) {
    return jsonError(429, 'RATE_LIMITED');
  }
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError(400, 'VALIDATION');

  const id = parsed.data.identifier;
  const user = await db.user.findFirst({
    where: { OR: [{ username: id }, { phone: id }, { email: id }] },
    select: { id: true },
  });

  if (user) {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: `pending:${user.id}:${Date.now()}`,
        ip,
        expiresAt,
        status: 'pending',
        identifier: id,
      },
    });

    // Best-effort admin ping (bell + Telegram). Never carries the token.
    try {
      await notifyAdminsPasswordResetRequested({ identifier: id, channel: 'admin' });
    } catch (err) {
      console.error('[forgot-password] admin notify failed', err);
    }
  }

  return jsonOk({
    ok: true,
    message: 'If the account exists, a reset request has been created. Please contact support to complete the reset.',
  });
}
