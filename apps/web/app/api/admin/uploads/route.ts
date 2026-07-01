// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { storeFile, type UploadCategory } from '@/lib/uploads/storage';
import { jsonError, jsonOk } from '@/lib/auth/errors';

const ALLOWED: UploadCategory[] = [
  'banners', 'banners_mobile', 'games', 'payment-proofs', 'apk', 'branding', 'categories', 'jackpot',
  // M4 Phase D upload widget categories.
  'promo_desktop', 'promo_mobile', 'promo_thumbnail', 'promo_background',
  'ambassadors', 'sponsors', 'payment_icons', 'provider_banners',
  'avatars',
  // Premium atelier: image assets for Spin + Lotto, and operator-
  // uploaded sound files for the playback hook.
  'atelier', 'sounds',
  // Banner hero video files (MP4 / WebM), stored as-is.
  'banner_videos',
];

export async function POST(req: NextRequest) {
  return withAuth(async () => {
    const session = await ensurePermission('banners.write'); // simplest staff write check
    const form = await req.formData();
    const file = form.get('file');
    const categoryRaw = String(form.get('category') ?? '');
    if (!(file instanceof File)) return jsonError(400, 'NO_FILE');
    if (!ALLOWED.includes(categoryRaw as UploadCategory)) return jsonError(400, 'BAD_CATEGORY');
    try {
      const stored = await storeFile(categoryRaw as UploadCategory, file);
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'UPLOAD',
        target: stored.url,
        detail: `${categoryRaw} ${stored.bytes} bytes`,
      });
      return jsonOk({ url: stored.url, bytes: stored.bytes });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Upload failed';
      return jsonError(400, 'UPLOAD_FAILED', msg);
    }
  });
}
