// Built by Anointed Coder.
//
// Pasha Native Games global on/off switch. SystemSetting key is
// `native_games_enabled`; values 'true' or 'false'. Defaults to ON so
// a missing row leaves the games playable.

import { db } from '@/lib/db/client';
import { NATIVE_GAMES_ENABLED_DEFAULT, NATIVE_GAMES_ENABLED_KEY } from './config';

export async function isNativeGamesEnabled(): Promise<boolean> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: NATIVE_GAMES_ENABLED_KEY }, select: { value: true } });
    const v = (row?.value ?? NATIVE_GAMES_ENABLED_DEFAULT).trim().toLowerCase();
    return v !== 'false' && v !== '0' && v !== 'off';
  } catch {
    return NATIVE_GAMES_ENABLED_DEFAULT === 'true';
  }
}

export async function setNativeGamesEnabled(enabled: boolean): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: NATIVE_GAMES_ENABLED_KEY },
    update: { value: enabled ? 'true' : 'false', type: 'boolean', category: 'general' },
    create: { key: NATIVE_GAMES_ENABLED_KEY, value: enabled ? 'true' : 'false', type: 'boolean', category: 'general' },
  });
}
