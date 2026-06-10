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

// ==========================================================================
// Multi-tier spin wheel defaults. Operator can fully reshape via
// /admin/spin-segments. The 3 tiers (Lucky / Grand / Supreme) ship as
// the reference design's reward ladder. Each tier has 8 wedges sized
// for casino-style rotation. payoutType=bonus uses turnoverX>0 so the
// existing spin_payout BonusRule + UserBonus turnover engine apply.
// ==========================================================================

export type SpinPayoutType = 'coins' | 'bonus' | 'freebet' | 'freespin' | 'nothing';

export interface DefaultTierSpec {
  key: 'lucky' | 'grand' | 'supreme';
  nameEn: string;
  nameBn: string;
  descriptionEn: string;
  descriptionBn: string;
  costPerSpin: number;
  freeSpinsPerDay: number;
  color: string;
  position: number;
}

export interface DefaultSegmentSpec {
  label: string;
  color: string;
  weight: number;
  payoutType: SpinPayoutType;
  payoutAmount: number;
  turnoverX: number;
  position: number;
}

export const DEFAULT_TIERS: DefaultTierSpec[] = [
  {
    key: 'lucky',
    nameEn: 'Wheel of Lucky Fortune',
    nameBn: 'হুইল অফ লাকি ফরচুন',
    descriptionEn: 'Casual wedges. Low cost, fast rounds.',
    descriptionBn: 'কম খরচে দ্রুত স্পিন। ছোট রিওয়ার্ড।',
    costPerSpin: 30,
    freeSpinsPerDay: 3,
    color: '#CD7F32',
    position: 0,
  },
  {
    key: 'grand',
    nameEn: 'Wheel of Grand Fortune',
    nameBn: 'হুইল অফ গ্র্যান্ড ফরচুন',
    descriptionEn: 'Mid-tier prizes. Bigger swings.',
    descriptionBn: 'মাঝারি স্তরের পুরস্কার। বড় সম্ভাবনা।',
    // Cost bumped 70 -> 100 to match the client's 30 / 100 / 500
    // coin ladder. The seed POST upserts by key without overwriting
    // operator edits, so existing rows pre-seeded at 70 stay; the
    // operator can adjust per-tier via /admin/spin-tiers.
    costPerSpin: 100,
    freeSpinsPerDay: 1,
    color: '#C0C0C0',
    position: 1,
  },
  {
    key: 'supreme',
    nameEn: 'Wheel of Supreme Fortune',
    nameBn: 'হুইল অফ সুপ্রিম ফরচুন',
    descriptionEn: 'Top-tier jackpot wedges. Premium spins.',
    descriptionBn: 'সর্বোচ্চ স্তরের জ্যাকপট। প্রিমিয়াম স্পিন।',
    costPerSpin: 500,
    freeSpinsPerDay: 0,
    color: '#F5B400',
    position: 2,
  },
];

export const DEFAULT_TIER_SEGMENTS: Record<DefaultTierSpec['key'], DefaultSegmentSpec[]> = {
  lucky: [
    { label: '1',  color: '#F59E0B', weight: 28, payoutType: 'coins',   payoutAmount: 1,  turnoverX: 0, position: 0 },
    { label: '2',  color: '#3B82F6', weight: 22, payoutType: 'coins',   payoutAmount: 2,  turnoverX: 0, position: 1 },
    { label: '3',  color: '#22C55E', weight: 18, payoutType: 'coins',   payoutAmount: 3,  turnoverX: 0, position: 2 },
    { label: '4',  color: '#EF4444', weight: 14, payoutType: 'coins',   payoutAmount: 4,  turnoverX: 0, position: 3 },
    { label: '5',  color: '#8B5CF6', weight: 10, payoutType: 'coins',   payoutAmount: 5,  turnoverX: 0, position: 4 },
    { label: '8',  color: '#F97316', weight: 6,  payoutType: 'coins',   payoutAmount: 8,  turnoverX: 0, position: 5 },
    { label: '9',  color: '#EC4899', weight: 3,  payoutType: 'coins',   payoutAmount: 9,  turnoverX: 0, position: 6 },
    { label: '10', color: '#64748B', weight: 1,  payoutType: 'coins',   payoutAmount: 10, turnoverX: 0, position: 7 },
  ],
  grand: [
    { label: '100',     color: '#3B82F6', weight: 28, payoutType: 'coins',   payoutAmount: 100,  turnoverX: 0, position: 0 },
    { label: '300',     color: '#22C55E', weight: 22, payoutType: 'coins',   payoutAmount: 300,  turnoverX: 0, position: 1 },
    { label: '500',     color: '#F59E0B', weight: 18, payoutType: 'coins',   payoutAmount: 500,  turnoverX: 0, position: 2 },
    { label: '888',     color: '#EF4444', weight: 12, payoutType: 'coins',   payoutAmount: 888,  turnoverX: 0, position: 3 },
    { label: '1,288',   color: '#8B5CF6', weight: 8,  payoutType: 'coins',   payoutAmount: 1288, turnoverX: 0, position: 4 },
    { label: '3,888',   color: '#EC4899', weight: 4,  payoutType: 'coins',   payoutAmount: 3888, turnoverX: 0, position: 5 },
    { label: 'BONUS 500', color: '#F97316', weight: 6, payoutType: 'bonus', payoutAmount: 500, turnoverX: 3, position: 6 },
    { label: 'TRY AGAIN', color: '#64748B', weight: 2, payoutType: 'nothing', payoutAmount: 0, turnoverX: 0, position: 7 },
  ],
  supreme: [
    { label: '500',      color: '#3B82F6', weight: 26, payoutType: 'coins',   payoutAmount: 500,   turnoverX: 0, position: 0 },
    { label: '1,000',    color: '#22C55E', weight: 22, payoutType: 'coins',   payoutAmount: 1000,  turnoverX: 0, position: 1 },
    { label: '2,500',    color: '#F59E0B', weight: 16, payoutType: 'coins',   payoutAmount: 2500,  turnoverX: 0, position: 2 },
    { label: '5,000',    color: '#EF4444', weight: 10, payoutType: 'coins',   payoutAmount: 5000,  turnoverX: 0, position: 3 },
    { label: '8,888',    color: '#8B5CF6', weight: 6,  payoutType: 'coins',   payoutAmount: 8888,  turnoverX: 0, position: 4 },
    { label: '25,000',   color: '#EC4899', weight: 2,  payoutType: 'coins',   payoutAmount: 25000, turnoverX: 0, position: 5 },
    { label: 'BONUS 5000', color: '#F97316', weight: 4, payoutType: 'bonus', payoutAmount: 5000, turnoverX: 5, position: 6 },
    { label: 'TRY AGAIN',  color: '#64748B', weight: 14, payoutType: 'nothing', payoutAmount: 0, turnoverX: 0, position: 7 },
  ],
};
