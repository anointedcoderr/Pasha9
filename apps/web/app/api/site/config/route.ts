// Built by Anointed Coder.
//
// Public site configuration. Returns the subset of SystemSetting keys
// the unauthenticated UI needs to decide which optional surfaces to
// render. Currently exposes a single flag - the Firebase Phone Auth
// Forgot Password switch - but the shape is open-ended so future
// public flags drop in without changing the endpoint contract.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

const PUBLIC_KEYS = [
  'forgot_password_enabled',
] as const;

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'Pragma': 'no-cache',
  'Expires': '0',
};

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
  return NextResponse.json(
    { forgotPasswordEnabled: forgotEnabled },
    { headers: NO_CACHE_HEADERS },
  );
}
