// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export const revalidate = 60;

export async function GET() {
  const sections = await db.homepageContent.findMany();
  return jsonOk({ sections });
}
