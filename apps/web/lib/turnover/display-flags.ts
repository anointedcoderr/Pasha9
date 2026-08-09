// Built by Anointed Coder.
//
// Per-section on/off flags controlling whether the user-facing wagering
// requirement TEXT is shown ("10x Turnover", "Wager 10x", "Requires 10x
// turnover before withdrawal"). Follows the same SystemSetting boolean
// pattern as lib/content/section-flags.ts.
//
// DISPLAY ONLY. Nothing here touches the turnover calculation, the withdrawal
// gate, or any grant. Turning a flag off hides a label; the player's actual
// wagering requirement is unchanged and still enforced on withdrawal. That
// separation was the client's explicit instruction and it is the whole risk
// in this feature: a flag that silently disabled the requirement would let
// locked bonus money walk out of the platform.
//
// Defaults are ON. A requirement the player has to meet should be visible
// unless an operator deliberately hides it, and the applicable terms remain
// in each section's own details copy regardless of these flags so the
// conditions are still disclosed before a player participates.

import { db } from '@/lib/db/client';

export const TURNOVER_DISPLAY_KEYS = {
  depositBonus: 'turnover_display_deposit_bonus',
  reloadBonus: 'turnover_display_reload_bonus',
  promotions: 'turnover_display_promotions',
  bettingPass: 'turnover_display_betting_pass',
  rewards: 'turnover_display_rewards',
  cashback: 'turnover_display_cashback',
  promoCode: 'turnover_display_promo_code',
  vip: 'turnover_display_vip',
  other: 'turnover_display_other',
} as const;

export type TurnoverDisplaySection = keyof typeof TURNOVER_DISPLAY_KEYS;

export type TurnoverDisplayFlags = Record<TurnoverDisplaySection, boolean>;

export const DEFAULT_TURNOVER_DISPLAY: TurnoverDisplayFlags = {
  depositBonus: true,
  reloadBonus: true,
  promotions: true,
  bettingPass: true,
  rewards: true,
  cashback: true,
  promoCode: true,
  vip: true,
  other: true,
};

function truthy(value: string | null | undefined, fallback: boolean): boolean {
  if (value == null) return fallback;
  const v = value.trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'on') return true;
  if (v === 'false' || v === '0' || v === 'off') return false;
  return fallback;
}

/**
 * Read every flag in one query. Never throws: any failure falls back to the
 * defaults (all visible), because failing "hidden" would quietly stop
 * disclosing a condition the player is bound by.
 */
export async function loadTurnoverDisplayFlags(): Promise<TurnoverDisplayFlags> {
  const entries = Object.entries(TURNOVER_DISPLAY_KEYS) as Array<[TurnoverDisplaySection, string]>;
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = await db.systemSetting.findMany({
      where: { key: { in: entries.map(([, k]) => k) } },
      select: { key: true, value: true },
    });
  } catch {
    return { ...DEFAULT_TURNOVER_DISPLAY };
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_TURNOVER_DISPLAY };
  for (const [section, key] of entries) {
    out[section] = truthy(map.get(key), DEFAULT_TURNOVER_DISPLAY[section]);
  }
  return out;
}

/** Persist one section's flag. Admin-only callers. */
export async function setTurnoverDisplayFlag(section: TurnoverDisplaySection, value: boolean): Promise<void> {
  const key = TURNOVER_DISPLAY_KEYS[section];
  await db.systemSetting.upsert({
    where: { key },
    update: { value: value ? 'true' : 'false', type: 'boolean', category: 'general' },
    create: { key, value: value ? 'true' : 'false', type: 'boolean', category: 'general' },
  });
}
