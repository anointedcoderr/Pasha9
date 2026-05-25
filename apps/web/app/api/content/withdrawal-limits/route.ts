// Built by Anointed Coder.
//
// Public read of withdrawal global limits + policy note so the
// /withdraw form can render real min/max hints. Matches the same
// SystemSetting keys edited from /admin/withdrawal-limits.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const DEFAULT_MIN = 500;
const DEFAULT_MAX = 200_000;

export async function GET() {
  const rows = await db.systemSetting.findMany({
    where: {
      key: { in: ['withdrawal_min_amount', 'withdrawal_max_amount', 'withdrawal_policy_note'] },
    },
  });
  const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
  const min = Number(map.get('withdrawal_min_amount') ?? DEFAULT_MIN) || DEFAULT_MIN;
  const max = Number(map.get('withdrawal_max_amount') ?? DEFAULT_MAX) || DEFAULT_MAX;
  return jsonOk({
    min,
    max,
    policy: map.get('withdrawal_policy_note') ?? '',
  });
}
