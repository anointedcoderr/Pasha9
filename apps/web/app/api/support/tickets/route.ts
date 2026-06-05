// Built by Anointed Coder.
//
// POST /api/support/tickets
//
// Public ticket submission. Logged-in users get userId attached
// automatically; guests can submit with a name + email/phone. The
// route is rate-limited per IP to slow obvious spam. Validation
// errors return 400 VALIDATION with the field list so the form can
// render inline messages.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getCurrentSession } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

const schema = z.object({
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters.').max(140),
  message: z.string().trim().min(10, 'Message must be at least 10 characters.').max(4000),
  name: z.string().trim().min(2).max(80).optional().nullable(),
  email: z.string().trim().email('Enter a valid email.').max(160).optional().nullable(),
  phone: z.string().trim().min(6).max(40).optional().nullable(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
  if (!(await rateLimit(`ticket:${ip ?? 'anon'}`, 10, 60 * 60_000))) {
    return jsonError(429, 'RATE_LIMITED', 'Too many ticket submissions from this address. Please try again later.');
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, 'VALIDATION', 'Please fix the highlighted fields.', { issues: parsed.error.issues });
  }

  // Resolve session, but do NOT require it. Guests are allowed.
  const session = await getCurrentSession().catch(() => null);

  // Guard against pure-empty guest submissions: at least one contact
  // hint OR a session must be present so admin can reply.
  if (!session && !parsed.data.email && !parsed.data.phone) {
    return jsonError(400, 'VALIDATION', 'Please provide an email or phone so we can reach you back.');
  }

  const ticket = await db.supportTicket.create({
    data: {
      userId: session?.sub ?? null,
      name: parsed.data.name ?? null,
      email: parsed.data.email ?? null,
      phone: parsed.data.phone ?? null,
      subject: parsed.data.subject,
      body: parsed.data.message,
      status: 'open',
      ip,
    },
    select: { id: true, status: true, createdAt: true },
  });

  return jsonOk({ ok: true, ticket }, 201);
}
