// Built by Anointed Coder.
//
// POST /api/admin/push-devices/test
// Sends a test phone push to the calling admin's own active devices so
// they can confirm delivery (sound + vibration, screen locked, etc.)
// without waiting for a real player event.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { dispatchFcmToUsers } from '@/lib/push/fcm';

export async function POST() {
  return withAuth(async () => {
    const session = await requireStaff();
    const push = await dispatchFcmToUsers([session.sub], {
      title: 'Pasha 9 test alert',
      body: 'Phone alerts are working. You will be notified of new deposits, withdrawals and VIP applications.',
      linkUrl: '/admin',
      kind: 'admin_test',
      priority: 'high',
    });
    return jsonOk({ ok: true, push });
  });
}
