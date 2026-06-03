// Built by Anointed Coder.
//
// PATCH /api/me/profile
// Body: { username?, phone?, email?, language?, avatarUrl? }
//
// Updates the calling user's profile. Enforces uniqueness on
// username and phone (the current user can keep their own value).
// Email is optional; empty string clears it. Language is restricted
// to bn|en to match the Lang enum.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensureUser, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-zA-Z0-9_.]+$/, 'letters, digits, _ . only').optional(),
  phone: z.string().trim().min(8).max(20).regex(/^0?1\d{9}$/, 'invalid Bangladeshi mobile').optional(),
  email: z.string().trim().max(200).email('invalid email').optional().or(z.literal('')),
  language: z.enum(['bn', 'en']).optional(),
  avatarUrl: z.string().trim().max(500).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensureUser();
    if (!(await rateLimit(`me:profile:${session.sub}`, 20, 60_000))) {
      return jsonError(429, 'RATE_LIMITED');
    }

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const data: Prisma.UserUncheckedUpdateInput = {};
    if (parsed.data.username !== undefined) {
      const taken = await db.user.findFirst({
        where: { username: parsed.data.username, NOT: { id: session.sub } },
        select: { id: true },
      });
      if (taken) return jsonError(409, 'USERNAME_TAKEN', 'Username is already taken.');
      data.username = parsed.data.username;
    }
    if (parsed.data.phone !== undefined) {
      const normalised = parsed.data.phone.startsWith('0') ? parsed.data.phone : `0${parsed.data.phone}`;
      const taken = await db.user.findFirst({
        where: { phone: normalised, NOT: { id: session.sub } },
        select: { id: true },
      });
      if (taken) return jsonError(409, 'PHONE_TAKEN', 'Phone number is already registered.');
      data.phone = normalised;
    }
    if (parsed.data.email !== undefined) {
      const email = parsed.data.email.trim();
      if (email === '') {
        data.email = null;
      } else {
        const taken = await db.user.findFirst({
          where: { email, NOT: { id: session.sub } },
          select: { id: true },
        });
        if (taken) return jsonError(409, 'EMAIL_TAKEN', 'Email is already registered.');
        data.email = email;
      }
    }
    if (parsed.data.language !== undefined) data.language = parsed.data.language;
    if (parsed.data.avatarUrl !== undefined) {
      const url = parsed.data.avatarUrl.trim();
      data.avatarUrl = url === '' ? null : url;
    }

    if (Object.keys(data).length === 0) return jsonError(400, 'NO_CHANGES');

    const updated = await db.user.update({
      where: { id: session.sub },
      data,
      select: { id: true, username: true, phone: true, email: true, language: true, avatarUrl: true, country: true },
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'PROFILE_UPDATE',
      target: session.sub,
      meta: { fields: Object.keys(data) },
    });

    return jsonOk({ user: updated });
  });
}
