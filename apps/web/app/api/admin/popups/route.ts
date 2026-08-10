// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const TARGETS = ['entry', 'homepage', 'deposit_page', 'deposit_click', 'withdrawal_page', 'auth_page', 'all_pages', 'custom_url'] as const;
const FREQUENCIES = ['always', 'once_per_user', 'once_per_session', 'once_per_day'] as const;
// Who sees the popup relative to being signed in. 'disabled' is kept here
// rather than folded into status so an operator can park a popup without
// losing its scheduling or its status.
const AUDIENCES = ['guest', 'authed', 'both', 'disabled'] as const;

const baseSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(2000),
  ctaLabel: z.string().max(60).optional().nullable(),
  ctaHref: z.string().max(500).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  status: z.enum(['active', 'hidden', 'paused']).default('active'),
  target: z.enum(TARGETS).default('entry'),
  targetUrl: z.string().max(300).optional().nullable(),
  frequency: z.enum(FREQUENCIES).default('always'),
  audience: z.enum(AUDIENCES).default('both'),
  imageUrl: z.string().max(600).optional().nullable(),
  audioUrl: z.string().max(600).optional().nullable(),
});

export async function GET() {
  return withAuth(async () => {
    await ensurePermission('popups.write');
    const popups = await db.popupAnnouncement.findMany({ orderBy: [{ createdAt: 'desc' }] });
    return jsonOk({ popups });
  });
}

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('popups.write');
    const body = await req.json().catch(() => ({}));
    const parsed = baseSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });
    const popup = await db.popupAnnouncement.create({
      data: {
        ...parsed.data,
        startAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
        endAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      },
    });
    await recordActivity({ actorId: session.sub, actorRole: session.role, action: 'POPUP_CREATE', target: popup.id });
    return jsonOk({ popup }, 201);
  });
}
