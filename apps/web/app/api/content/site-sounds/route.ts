// Built by Anointed Coder.
//
// GET /api/content/site-sounds
//
// Public read of the operator-uploaded sound URLs for the premium
// Spin and Lotto modules. Returns the URL map plus the global
// master enable flag and default volume. Empty slots return null
// so the client hook can no-op silently.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { SOUND_SLOTS, MASTER_ENABLED_KEY, DEFAULT_VOLUME_KEY } from '@/lib/sounds/slots';

const ALL_KEYS = [MASTER_ENABLED_KEY, DEFAULT_VOLUME_KEY, ...SOUND_SLOTS.map((s) => s.key)] as const;

export async function GET() {
  const rows = await db.systemSetting
    .findMany({ where: { key: { in: [...ALL_KEYS] } } })
    .catch(() => [] as Array<{ key: string; value: string | null }>);
  const map: Record<string, string> = {};
  for (const r of rows) if (r.value && r.value.trim()) map[r.key] = r.value.trim();

  const enabled = map[MASTER_ENABLED_KEY] !== '0';
  const volumeRaw = Number(map[DEFAULT_VOLUME_KEY] ?? '70');
  const defaultVolume = Number.isFinite(volumeRaw) ? Math.max(0, Math.min(1, volumeRaw / 100)) : 0.7;

  const sounds: Record<string, string | null> = {};
  for (const slot of SOUND_SLOTS) sounds[slot.id] = map[slot.key] || null;

  return jsonOk({ enabled, defaultVolume, sounds });
}
