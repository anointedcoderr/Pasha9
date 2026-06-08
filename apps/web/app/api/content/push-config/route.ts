// Built by Anointed Coder.
//
// GET /api/content/push-config
// Exposes the VAPID public key + provider status so the client can
// decide whether to call PushManager.subscribe(). When VAPID_PUBLIC_KEY
// is not set the client falls back to in-app notifications only and
// suppresses the "Enable device notifications" button.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { jsonOk } from '@/lib/auth/errors';
import { isVapidConfigured } from '@/lib/push/vapid-provider';

export async function GET() {
  const publicKey = (process.env.VAPID_PUBLIC_KEY ?? '').trim();
  return jsonOk({
    configured: isVapidConfigured(),
    publicKey: publicKey || null,
  });
}
