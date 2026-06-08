// Built by Anointed Coder.
//
// GET /api/content/social-links
//
// Public list of active social-media links rendered in the footer.
// Empty array means the Footer falls back to the legacy contact
// SystemSetting trio (telegram_url, whatsapp_url, support_email) so a
// fresh database still shows something useful.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const links = await db.socialLink.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      platform: true,
      label: true,
      labelBn: true,
      url: true,
      iconUrl: true,
      sortOrder: true,
    },
  });
  return jsonOk({ links });
}
