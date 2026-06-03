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

// Separate flag that gates only the PUBLIC visibility (mobile drawer,
// /games strip, homepage Pasha Originals row, /games/<code> friendly
// routes). The admin SystemSetting native_games_enabled flag stays
// independent so the operator can keep tooling alive while hiding the
// games from players. Default OFF so the platform shows provider
// games only until the operator flips it on.
export const NATIVE_GAMES_PUBLIC_KEY = 'native_games_public_enabled';

export async function isNativeGamesPublic(): Promise<boolean> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: NATIVE_GAMES_PUBLIC_KEY }, select: { value: true } });
    if (!row) return false;
    return (row.value ?? '').trim().toLowerCase() === 'true';
  } catch {
    return false;
  }
}
