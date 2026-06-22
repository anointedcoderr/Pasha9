// Built by Anointed Coder.
//
// GET /api/admin/push-config
// Tells the admin "Enable phone alerts" UI whether FCM phone push is
// usable: `configured` is true only when the server can SEND (firebase
// admin creds present) AND the public VAPID key needed by the browser
// getToken() call is set. The VAPID public key is safe to expose.

export const dynamic = 'force-dynamic';

import { withAuth } from '@/lib/auth/guard';
import { requireStaff } from '@/lib/auth/rbac';
import { jsonOk } from '@/lib/auth/errors';
import { isFirebaseConfigured } from '@/lib/firebase/admin';

export async function GET() {
  return withAuth(async () => {
    await requireStaff();
    const vapidKey = (process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '').trim() || null;
    return jsonOk({
      configured: isFirebaseConfigured() && Boolean(vapidKey),
      vapidKey,
    });
  });
}
