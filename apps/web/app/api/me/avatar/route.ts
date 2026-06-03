// Built by Anointed Coder.
//
// POST /api/me/avatar  multipart with "file" field
//
// Stores the image under category=avatars and writes the public URL
// onto User.avatarUrl. Returns { avatarUrl }. Rate-limited.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { storeFile } from '@/lib/uploads/storage';

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    const limit = rateLimit(`me-avatar:${session.sub}`, 6, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, 'BAD_FORM', 'Could not parse upload.');
    }
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError(400, 'FILE_MISSING');

    let stored;
    try {
      stored = await storeFile('avatars', file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      const isMime = msg.toLowerCase().includes('mime');
      const isSize = msg.toLowerCase().includes('too large');
      const code = isMime ? 'BAD_MIME' : isSize ? 'TOO_LARGE' : 'UPLOAD_FAILED';
      return jsonError(400, code, msg);
    }

    await db.user.update({ where: { id: session.sub }, data: { avatarUrl: stored.url } });
    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'AVATAR_UPDATE',
      target: stored.url,
      meta: { bytes: stored.bytes },
    });
    return jsonOk({ avatarUrl: stored.url });
  });
}
