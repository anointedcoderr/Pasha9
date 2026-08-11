// Built by Anointed Coder.
//
// GET /api/staff/points - the SIGNED-IN staff member's own point balance.
//
// Self-serve, no special permission beyond being signed in as staff/admin,
// because every staff member with Balance Management access needs to see
// their own remaining points before attempting a credit - otherwise they
// only find out they are out of points after a credit is rejected. A
// super_admin has no wallet of their own; they are unrestricted, so this
// always returns null for them rather than a 0 that would read as "no
// points left".

export const dynamic = 'force-dynamic';

import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { loadStaffPointBalance } from '@/lib/staff/points';
import { db } from '@/lib/db/client';

export async function GET() {
  return withAuth(async () => {
    const session = await ensurePermission('users.balance.adjust');
    if (session.role === 'super_admin') {
      return jsonOk({ unrestricted: true, balance: null });
    }
    const balance = await loadStaffPointBalance(db, session.sub);
    return jsonOk({ unrestricted: false, balance: Number(balance) });
  });
}
