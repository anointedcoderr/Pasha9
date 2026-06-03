// Built by Anointed Coder.
//
// POST /api/deposits/proof
//
// Player-facing payment-proof upload. Multipart/form-data with a
// single `file` field. Stores the file under category=`payment-proofs`
// (PNG / JPG / WEBP / PDF, max 8 MB) and returns the public URL the
// deposit form then submits as `proofUrl`.
//
// Auth: signed-in active user only. Rate-limited at 10 uploads per
// 10 minutes per user to keep the disk safe from abuse without
// blocking honest retries.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { requireActiveUser } from '@/lib/auth/rbac';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { storeFile } from '@/lib/uploads/storage';

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`deposit-proof:${session.sub}`, 10, 10 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return jsonError(400, 'BAD_FORM', 'Could not parse upload.');
    }
    const file = form.get('file');
    if (!(file instanceof File)) return jsonError(400, 'FILE_MISSING', 'Attach a file under the "file" field.');

    let stored;
    try {
      stored = await storeFile('payment-proofs', file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      const isMime = msg.toLowerCase().includes('mime');
      const isSize = msg.toLowerCase().includes('too large');
      const code = isMime ? 'BAD_MIME' : isSize ? 'TOO_LARGE' : 'UPLOAD_FAILED';
      return jsonError(400, code, msg);
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'DEPOSIT_PROOF_UPLOAD',
      target: stored.url,
      meta: { bytes: stored.bytes, mime: file.type || 'unknown' },
    });

    // Never expose the absolute disk path. The public URL is all the
    // form needs to attach to the deposit submission.
    return jsonOk({ proofUrl: stored.url, bytes: stored.bytes });
  });
}
