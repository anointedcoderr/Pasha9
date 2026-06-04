// Built by Anointed Coder.
//
// Betting Pass runtime configuration. Lives in two SystemSetting keys
// (point multipliers + global on/off) plus the BettingPassRule table
// (one row per tier reward). Admin tunes both from /admin/betting-pass.

import { db } from '@/lib/db/client';

export interface BettingPassConfig {
  enabled: boolean;
  // Points awarded per 1 BDT of approved deposit.
  pointsPerBdtDeposit: number;
  // Points awarded per 1 BDT of accepted provider bet wager.
  pointsPerBdtBet: number;
  // Season label so the operator can reset by changing the season key
  // (future iteration; current MVP keeps lifetime points).
  seasonKey: string;
}

const DEFAULT: BettingPassConfig = {
  enabled: true,
  pointsPerBdtDeposit: 1,
  pointsPerBdtBet: 1,
  seasonKey: 'season_1',
};

export async function loadBettingPassConfig(): Promise<BettingPassConfig> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: 'betting_pass_config_v1' } });
    if (!row) return DEFAULT;
    const parsed = JSON.parse(row.value);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : DEFAULT.enabled,
      pointsPerBdtDeposit: Number.isFinite(Number(parsed.pointsPerBdtDeposit)) ? Number(parsed.pointsPerBdtDeposit) : DEFAULT.pointsPerBdtDeposit,
      pointsPerBdtBet: Number.isFinite(Number(parsed.pointsPerBdtBet)) ? Number(parsed.pointsPerBdtBet) : DEFAULT.pointsPerBdtBet,
      seasonKey: typeof parsed.seasonKey === 'string' && parsed.seasonKey.trim() ? parsed.seasonKey : DEFAULT.seasonKey,
    };
  } catch {
    return DEFAULT;
  }
}

export async function saveBettingPassConfig(next: BettingPassConfig): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: 'betting_pass_config_v1' },
    update: { value: JSON.stringify(next), type: 'json', category: 'rewards' },
    create: { key: 'betting_pass_config_v1', value: JSON.stringify(next), type: 'json', category: 'rewards' },
  });
}
