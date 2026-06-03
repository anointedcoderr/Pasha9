// Built by Anointed Coder.
//
// GET /api/admin/upload-constraints/[categoryKey]
//
// Admin-only read of a single UploadConstraint row keyed by the
// /api/admin/uploads category. Drives the reusable <ImageUpload>
// widget so every banner / icon / thumbnail field shows the required
// dimensions, accepted MIME list, max bytes and a translator-ready
// note. Returns a safe fallback shape when the constraint row is
// missing so the widget stays usable.

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';

const DEFAULT_FALLBACK = {
  acceptedMime: 'image/png,image/jpeg,image/webp',
  maxBytes: 4 * 1024 * 1024,
  requiredWidth: null as number | null,
  requiredHeight: null as number | null,
  label: 'Image',
  noteEn: null as string | null,
  noteBn: null as string | null,
};

export async function GET(_req: Request, { params }: { params: { categoryKey: string } }) {
  return withAuth(async () => {
    await ensurePermission('settings.write');
    const row = await db.uploadConstraint.findUnique({ where: { categoryKey: params.categoryKey } });
    if (!row) {
      return jsonOk({ constraint: { categoryKey: params.categoryKey, ...DEFAULT_FALLBACK, fallback: true } });
    }
    return jsonOk({
      constraint: {
        categoryKey: row.categoryKey,
        label: row.label,
        requiredWidth: row.requiredWidth,
        requiredHeight: row.requiredHeight,
        acceptedMime: row.acceptedMime,
        maxBytes: row.maxBytes,
        noteEn: row.noteEn,
        noteBn: row.noteBn,
        fallback: false,
      },
    });
  });
}
