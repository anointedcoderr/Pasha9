// Built by Anointed Coder.
//
// SystemSetting-backed config for the Rewards / Check-in / Spin
// surfaces. Stored as JSON blobs under fixed keys so the operator can
// edit copy / cadence / coin amounts / turnover from a single admin
// surface without a schema migration.

import { db } from '@/lib/db/client';

export interface CheckInConfig {
  enabled: boolean;
  autoCheckIn: boolean;
  titleEn: string;
  titleBn: string;
  bodyEn: string;
  bodyBn: string;
  dailyCoins: number;
  streakBonusDay7: number;
  minDepositRequirement: number;
  minBetRequirement: number;
  insufficientCoinsTextEn: string;
  insufficientCoinsTextBn: string;
}

export interface SpinConfig {
  enabled: boolean;
  titleEn: string;
  titleBn: string;
  costPerSpinCoins: number;
  freeSpinsPerDay: number;
  defaultTurnoverX: number;
  rulesEn: string;
  rulesBn: string;
}

const CHECK_IN_KEY = 'rewards_checkin_config_v1';
const SPIN_KEY = 'rewards_spin_config_v1';

const DEFAULT_CHECK_IN: CheckInConfig = {
  enabled: true,
  autoCheckIn: false,
  titleEn: 'Daily Check-in',
  titleBn: 'ডেইলি চেক ইন',
  bodyEn: 'Visit every day and grow your streak. Earn coins for each consecutive day.',
  bodyBn: 'প্রতিদিন ভিজিট করুন, স্ট্রিক বাড়ান এবং প্রতিদিন কয়েন জিতুন।',
  dailyCoins: 50,
  streakBonusDay7: 200,
  minDepositRequirement: 50,
  minBetRequirement: 50,
  insufficientCoinsTextEn: 'You do not have enough coins to claim this reward.',
  insufficientCoinsTextBn: 'এই রিওয়ার্ড দাবি করার জন্য আপনার পর্যাপ্ত কয়েন নেই।',
};

const DEFAULT_SPIN: SpinConfig = {
  enabled: true,
  titleEn: 'Lucky Spin',
  titleBn: 'লাকি স্পিন',
  costPerSpinCoins: 100,
  freeSpinsPerDay: 3,
  defaultTurnoverX: 3,
  rulesEn: '1 spin = 100 coins. 3 free spins every day. Wallet credits require turnover.',
  rulesBn: '১ স্পিন = ১০০ কয়েন। প্রতিদিন ৩টি ফ্রি স্পিন। ওয়ালেট ক্রেডিটের জন্য টার্নওভার প্রয়োজন।',
};

async function loadJsonSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await db.systemSetting.findUnique({ where: { key } });
  if (!row) return fallback;
  try {
    const parsed = JSON.parse(row.value);
    return { ...fallback, ...parsed } as T;
  } catch {
    return fallback;
  }
}

export async function loadCheckInConfig(): Promise<CheckInConfig> {
  return loadJsonSetting<CheckInConfig>(CHECK_IN_KEY, DEFAULT_CHECK_IN);
}

export async function loadSpinConfig(): Promise<SpinConfig> {
  return loadJsonSetting<SpinConfig>(SPIN_KEY, DEFAULT_SPIN);
}

export async function saveCheckInConfig(next: Partial<CheckInConfig>): Promise<CheckInConfig> {
  const current = await loadCheckInConfig();
  const merged: CheckInConfig = { ...current, ...next };
  await db.systemSetting.upsert({
    where: { key: CHECK_IN_KEY },
    update: { value: JSON.stringify(merged), type: 'json', category: 'rewards' },
    create: { key: CHECK_IN_KEY, value: JSON.stringify(merged), type: 'json', category: 'rewards' },
  });
  return merged;
}

export async function saveSpinConfig(next: Partial<SpinConfig>): Promise<SpinConfig> {
  const current = await loadSpinConfig();
  const merged: SpinConfig = { ...current, ...next };
  await db.systemSetting.upsert({
    where: { key: SPIN_KEY },
    update: { value: JSON.stringify(merged), type: 'json', category: 'rewards' },
    create: { key: SPIN_KEY, value: JSON.stringify(merged), type: 'json', category: 'rewards' },
  });
  return merged;
}

export { CHECK_IN_KEY, SPIN_KEY, DEFAULT_CHECK_IN, DEFAULT_SPIN };
