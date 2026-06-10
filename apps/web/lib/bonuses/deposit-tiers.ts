// Built by Anointed Coder.
//
// M4 Phase C deposit-tier service. DepositBonusTier is the admin
// surface; the bonus engine still reads BonusRule. This module:
//
//   - pickBestTier(amount)
//     returns the active tier with the highest minDeposit <= amount.
//     Used by /api/content/deposit-preview and /api/deposits to
//     snapshot the promised bonus at submit time.
//
//   - syncTierToBonusRule(tier)
//     materialises a tier row into a BonusRule of type='reload' so
//     the existing applyDepositBonuses engine grants the bonus on
//     approval. Code key is stable per tier (`deposit_tier_<id>`)
//     so re-saving the same tier upserts rather than creating dupes.
//
//   - removeTierBonusRule(tierId)
//     drops the matching BonusRule when the tier is deleted.
//
// The engine picks the highest-priority matching reload rule, so we
// stamp `priority = max(100, minDeposit / 100)` to keep "bigger tier
// wins" the natural outcome.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

export interface ActiveTier {
  id: string;
  minDeposit: number;
  percentage: number;
  position: number;
}

export interface PreviewResult {
  tier: ActiveTier | null;
  bonusPercentage: number;
  bonusAmount: number;
  totalCredit: number;
}

function tierToCode(tierId: string): string {
  return `deposit_tier_${tierId}`;
}

function rowToActive(row: { id: string; minDeposit: Prisma.Decimal; percentage: number; position: number }): ActiveTier {
  return {
    id: row.id,
    minDeposit: Number(row.minDeposit),
    percentage: row.percentage,
    position: row.position,
  };
}

/** Compute the deposit preview for a given amount. Returns a zero
 *  bonus when no active tier matches. */
export async function pickBestTier(amount: number): Promise<PreviewResult> {
  if (!Number.isFinite(amount) || amount <= 0) {
    return { tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: Math.max(0, amount || 0) };
  }
  const rows = await db.depositBonusTier.findMany({
    where: { isActive: true, minDeposit: { lte: new Prisma.Decimal(amount) } },
    orderBy: [{ minDeposit: 'desc' }, { percentage: 'desc' }, { position: 'desc' }],
    take: 1,
  });
  const row = rows[0];
  if (!row) {
    return { tier: null, bonusPercentage: 0, bonusAmount: 0, totalCredit: amount };
  }
  const tier = rowToActive(row);
  const bonusAmount = Math.round((amount * tier.percentage) / 100 * 100) / 100;
  return {
    tier,
    bonusPercentage: tier.percentage,
    bonusAmount,
    totalCredit: amount + bonusAmount,
  };
}

/** Upsert the BonusRule row that backs a tier so the bonus engine
 *  grants the bonus on deposit approval. Idempotent: re-saving a
 *  tier updates the existing rule by code, never duplicates. */
export async function syncTierToBonusRule(tier: {
  id: string;
  minDeposit: Prisma.Decimal | number;
  percentage: number;
  isActive: boolean;
  position: number;
  // Optional - tiers created before turnoverX shipped read as
  // undefined. Default to 0 (no per-grant wager lock) for those.
  turnoverX?: Prisma.Decimal | number | null;
  titleEn?: string | null;
  titleBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  bannerUrl?: string | null;
}): Promise<void> {
  const code = tierToCode(tier.id);
  const minDeposit = tier.minDeposit instanceof Prisma.Decimal ? tier.minDeposit : new Prisma.Decimal(tier.minDeposit);
  const minDepositNumber = Number(minDeposit);
  const priority = Math.max(100, Math.floor(minDepositNumber / 100));
  // Admin can override the title from /admin/deposit-bonus-tiers; if
  // not set we fall back to a clean user-facing summary line. The old
  // "Auto-managed by /admin/..." description has been retired -
  // either the operator provides a description or we leave it empty.
  const name = (tier.titleEn?.trim() || `Deposit tier ${tier.percentage}% (>= ${minDepositNumber.toLocaleString()} BDT)`);
  const description = tier.descriptionEn?.trim() || null;
  const descriptionBn = tier.descriptionBn?.trim() || null;
  const bannerUrl = tier.bannerUrl?.trim() || null;
  // turnoverX is the per-grant wager multiplier. e.g. 10 means the
  // bonus must be wagered 10x before the player can withdraw it.
  // The bonus engine multiplies bonus.amount by this value to set
  // UserBonus.turnoverRequired, and addTurnover ticks down the
  // requirement as the player wagers. Negative or non-finite values
  // collapse to 0 so a malformed admin input cannot lock funds
  // forever.
  const rawTurnover = tier.turnoverX == null ? 0 : Number(tier.turnoverX);
  const safeTurnover = Number.isFinite(rawTurnover) && rawTurnover > 0 ? rawTurnover : 0;
  const turnoverX = new Prisma.Decimal(safeTurnover);

  const data = {
    name,
    type: 'reload' as const,
    percentage: new Prisma.Decimal(tier.percentage),
    amount: new Prisma.Decimal(0),
    minDeposit,
    maxBonus: new Prisma.Decimal(0),
    status: (tier.isActive ? 'active' : 'hidden') as 'active' | 'hidden',
    description,
    descriptionBn,
    bannerUrl,
    turnoverX,
    validityDays: 30,
    priority,
    meta: { managedBy: 'deposit_bonus_tier', tierId: tier.id } as Prisma.JsonObject,
  };

  await db.bonusRule.upsert({
    where: { code },
    update: data,
    create: { ...data, code },
  });
}

/** Drops the BonusRule row tied to a deleted tier. No-op when the
 *  row never existed (e.g. tier saved then deleted before its rule
 *  materialised). */
export async function removeTierBonusRule(tierId: string): Promise<void> {
  const code = tierToCode(tierId);
  await db.bonusRule.deleteMany({ where: { code } });
}

/** Guarantee the BonusRule backing an active tier is present, fresh,
 *  and active. Used by /api/deposits at submit time and by
 *  /api/admin/deposits/[id]/approve in the recovery branch so the
 *  engine never falls through to "no rule found" when a tier matches.
 *
 *  Self-healing was added because the in-memory observation was:
 *  the tier exists with isActive=true, pickBestTier returns a
 *  positive bonusAmount, the preview UI promises 500 BDT, but the
 *  saved Deposit row has promotionRuleId=NULL because the matching
 *  BonusRule either was never synced (legacy tier created before the
 *  sync code shipped) or got flipped to status='hidden' / deleted
 *  out of band. The fix runs syncTierToBonusRule inline whenever
 *  the lookup returns null or a non-active row, then re-fetches.
 *  Returns null only when the tier itself is inactive. */
export async function resolveActiveTierRule(tier: {
  id: string;
  minDeposit: Prisma.Decimal | number;
  percentage: number;
  isActive: boolean;
  position: number;
  turnoverX?: Prisma.Decimal | number | null;
  titleEn?: string | null;
  titleBn?: string | null;
  descriptionEn?: string | null;
  descriptionBn?: string | null;
  bannerUrl?: string | null;
}): Promise<{ id: string; code: string } | null> {
  if (!tier.isActive) return null;
  const code = tierToCode(tier.id);
  let rule = await db.bonusRule.findUnique({ where: { code }, select: { id: true, code: true, status: true } });
  if (rule && rule.status === 'active') return { id: rule.id, code: rule.code! };
  try {
    await syncTierToBonusRule(tier);
  } catch (err) {
    console.error('[deposit-bonus-tiers] inline resolve sync failed', err);
    return null;
  }
  rule = await db.bonusRule.findUnique({ where: { code }, select: { id: true, code: true, status: true } });
  if (!rule || rule.status !== 'active') return null;
  return { id: rule.id, code: rule.code! };
}

/** Re-sync every tier to its BonusRule. Used by the admin "Resync"
 *  button so a stuck row can be reconciled on demand. */
export async function resyncAllTiers(): Promise<{ synced: number; removed: number }> {
  const tiers = await db.depositBonusTier.findMany();
  for (const t of tiers) {
    await syncTierToBonusRule(t);
  }
  // Drop any orphaned tier-coded BonusRule rows whose tier no longer
  // exists. Limit to deposit_tier_* code prefix so unrelated rules
  // stay untouched.
  const tierIds = new Set(tiers.map((t) => t.id));
  const orphanRules = await db.bonusRule.findMany({
    where: { code: { startsWith: 'deposit_tier_' } },
    select: { id: true, code: true },
  });
  let removed = 0;
  for (const r of orphanRules) {
    const tierId = r.code?.replace('deposit_tier_', '') ?? '';
    if (!tierIds.has(tierId)) {
      await db.bonusRule.delete({ where: { id: r.id } });
      removed += 1;
    }
  }
  return { synced: tiers.length, removed };
}
