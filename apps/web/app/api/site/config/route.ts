// Built by Anointed Coder.
//
// Public site configuration. Returns the subset of SystemSetting keys
// the unauthenticated UI needs to decide which optional surfaces to
// render. Currently exposes a single flag - the Firebase Phone Auth
// Forgot Password switch - but the shape is open-ended so future
// public flags drop in without changing the endpoint contract.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const PUBLIC_KEYS = [
  'forgot_password_enabled',
] as const;

export async function GET() {
  let forgotEnabled = false;
  try {
    const rows = await db.systemSetting.findMany({
      where: { key: { in: [...PUBLIC_KEYS] } },
      select: { key: true, value: true },
    });
    const map = new Map(rows.map((r) => [r.key, (r.value ?? '').trim()]));
    forgotEnabled = map.get('forgot_password_enabled') === '1';
  } catch {
    // DB hiccup -> defaults are all off, which is the safe direction.
  }
  return jsonOk({ forgotPasswordEnabled: forgotEnabled });
}
