// Built by Anointed Coder.
//
// Turnover gate for the withdrawal flow. Combines three real gates:
//
//   1. Deposit gate (existing). lifetime-aggregate:
//        depositRequired  = SUM(Deposit.amount where status='approved') * multiplier
//        depositCompleted = SUM(ProviderTransaction.betAmount where status='accepted')
//
//   2. Betting Pass BDT Balance gate (per-grant). Each claim of a
//        rewardKind='bdt_balance' tier creates an active UserBonus row
//        with sourceType='betting_pass_bdt' and turnoverRequired =
//        rewardAmount * tier.turnoverX. The bonus engine's
//        addTurnover() loop ticks down UserBonus.turnoverProgress as
//        the player wagers, and flips status to 'completed' (via
//        releaseBonus, which is a no-op for this sourceType because
//        the money landed in Wallet.balance at claim time, not
//        lockedBalance).
//
//   3. Referral reward gate (per-grant). Paid fixed rewards and
//        percentage commissions land in Wallet.balance and create
//        active UserBonus rows until their configured turnover is met.
//
// Combined totals reported to the UI and used by the POST gate:
//   requiredTurnover  = depositRequired + bettingPassRequired
//   completedTurnover = depositCompleted + bettingPassCompleted
//   remainingTurnover = max(0, requiredTurnover - completedTurnover)
//
// The same accepted bet ticks down BOTH gates (deposit completed +
// the FIFO-distributed UserBonus.turnoverProgress). That is intentional
// per client spec: a 100 BDT @ 20x BP reward must add 2000 BDT to the
// total required turnover, and a 1000 BDT wager closes 1000 BDT of
// the required total (against the BP grant FIFO).

import { db } from '@/lib/db/client';

const SETTING_KEY = 'deposit_turnover_multiplier';
const DEFAULT_MULTIPLIER = 1.0;

// Active UserBonus grants with these sourceTypes represent BDT
// Balance rewards that landed in Wallet.balance and are still under
// a wager requirement. They also drive the withdrawable-balance
// subtraction.
//
// The list grew from a single string to an array when the deposit-
// bonus family ('deposit', 'promotion_deposit', 'promotion_claim',
// 'manual') moved into balance-direct accounting per client product
// direction. Every active grant under one of these source types
// blocks the granted amount from being withdrawn until the bonus
// turnover is met. The existing UserBonus.turnoverRequired and
// turnoverProgress columns drive the gate.
const BDT_BALANCE_LOCK_SOURCE_TYPES: string[] = [
  'betting_pass_bdt',
  'deposit',
  'promotion_deposit',
  'promotion_claim',
  'manual',
  // Betting Pass bonus/coins/freebet reward kinds (sourceType=
  // 'betting_pass') and the cashback campaign + promo code paths
  // create UserBonus rows with a positive turnoverRequired but
  // were not enforced by the gate before. Players could withdraw
  // these bonuses before completing the wager requirement. These
  // three source types match what the engines actually write -
  // see lib/betting-pass/engine.ts:275, lib/cashback/engine.ts:163,
  // lib/promo-codes/redeem.ts:144 - and close the bypass.
  'betting_pass',
  'cashback_campaign',
  'promo_code',
  // WinGo tournament prizes credit Wallet.balance directly with an
  // optional turnoverX lock tracked via a UserBonus row of this source
  // type (see lib/tournaments/engine.ts). Without this entry the lock
  // was a no-op and a winner could withdraw the prize before turning it
  // over - identical to the earlier promo_code / cashback_campaign
  // bypass. addTurnover advances these grants FIFO like every other
  // sourceType; a turnoverX=0 prize creates no UserBonus (pure cash) so
  // it never appears here.
  'tournament_prize',
  // Staff balance credits (app/api/admin/users/[id]/balance/route.ts). A
  // staff member crediting a player creates a grant of this sourceType
  // carrying the auto-applied staff turnover multiplier. It belongs in THIS
  // list rather than a separate bucket because the credit lands in
  // Wallet.balance as spendable money - which is exactly what this list is
  // for, and the reason it must also drive the balance lock: without it the
  // player could withdraw a staff credit immediately, turnover requirement
  // and all, because the gate never knew the grant existed.
  'staff_balance_add',
];

// Registration bonus (lib/bonuses/registration.ts). Deliberately its OWN
// bucket rather than an entry in the list above, because the two lists do
// two different jobs and this sourceType needs only one of them.
//
// The turnover half it DOES need: addTurnover() has no sourceType filter at
// all - it walks EVERY active grant FIFO. This gate does filter. Any
// sourceType addTurnover consumes but the gate omits becomes a turnover
// black hole: the grant silently absorbs the player's wagers (oldest-first,
// so a bonus issued at signup eats them before any later deposit grant)
// while contributing nothing to the figures the player is shown. They watch
// deposit turnover sit at 0 no matter how much they wager. A live player hit
// exactly this.
//
// The balance-lock half it must NOT have: BDT_BALANCE_LOCK_SOURCE_TYPES also
// drives computeBdtBalanceLocked, which the withdrawal route subtracts on top
// of wallet.lockedBalance. A registration bonus granted with lockWinnings
// (the default) already put its money in bonusBalance + lockedBalance, so
// counting it there too would subtract the same amount twice and understate
// withdrawable balance.
const REGISTRATION_LOCK_SOURCE_TYPES = ['registration_bonus'];
const REFERRAL_LOCK_SOURCE_TYPES = ['referral_first_deposit', 'referral_commission'];
// Spin wheel cash + free-bet payouts land in Wallet.balance with a
// per-segment turnover lock. Kept in their OWN bucket (not the deposit /
// betting-pass list) so the withdrawal breakdown shows a dedicated "Spin
// Reward Turnover" line, instead of silently folding the spin turnover
// into the Betting Pass numbers where the operator cannot see it.
const SPIN_LOCK_SOURCE_TYPES = ['spin_result_cash', 'spin_result_freebet'];

export interface DepositTurnoverStatus {
  multiplier: number;
  approvedDepositTotal: number;

  // ----- Per-source breakdown (UI uses these to render two rows) -----
  depositRequired: number;
  depositCompleted: number;
  depositRemaining: number;

  bettingPassRequired: number;
  bettingPassCompleted: number;
  bettingPassRemaining: number;

  referralRequired: number;
  referralCompleted: number;
  referralRemaining: number;

  spinRequired: number;
  spinCompleted: number;
  spinRemaining: number;

  registrationRequired: number;
  registrationCompleted: number;
  registrationRemaining: number;

  // ----- Combined totals (what the gate enforces) -----
  requiredTurnover: number;
  completedTurnover: number;
  remainingTurnover: number;
  isMet: boolean;

  // Sum of active rewards credited directly to Wallet.balance but
  // still under a turnover requirement. Subtracted from the
  // withdrawable balance independently of the gate above so that the
  // available-balance check fails fast even if the deposit gate is
  // disabled (multiplier=0).
  bdtBalanceLocked: number;
  referralBalanceLocked: number;
  spinBalanceLocked: number;
}

export async function computeBdtBalanceLocked(userId: string): Promise<number> {
  try {
    const agg = await db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: BDT_BALANCE_LOCK_SOURCE_TYPES } },
      _sum: { amount: true },
    });
    return Math.max(0, Number(agg._sum?.amount ?? 0));
  } catch {
    return 0;
  }
}

export async function computeReferralBalanceLocked(userId: string): Promise<number> {
  try {
    const agg = await db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: REFERRAL_LOCK_SOURCE_TYPES } },
      _sum: { amount: true },
    });
    return Math.max(0, Number(agg._sum?.amount ?? 0));
  } catch {
    return 0;
  }
}

export async function computeSpinBalanceLocked(userId: string): Promise<number> {
  try {
    const agg = await db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: SPIN_LOCK_SOURCE_TYPES } },
      _sum: { amount: true },
    });
    return Math.max(0, Number(agg._sum?.amount ?? 0));
  } catch {
    return 0;
  }
}

export async function loadDepositTurnoverMultiplier(): Promise<number> {
  try {
    const row = await db.systemSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
    if (!row) return DEFAULT_MULTIPLIER;
    const v = Number(row.value);
    if (!Number.isFinite(v) || v < 0) return DEFAULT_MULTIPLIER;
    return v;
  } catch {
    return DEFAULT_MULTIPLIER;
  }
}

// Returns the timestamp of the most recent auto_loss_reset TurnoverEvent
// for this user, or null if there hasn't been a full-balance loss. The
// helper settleLostBonusesIfBust in lib/bonuses/engine.ts writes one of
// these rows every time the player wagers their wallet down to under 1
// BDT, so any row that exists means "the player went bust at this point
// in time". The deposit-gate uses it as a hard cutoff: deposits approved
// before this stamp and bets accepted before this stamp do not count
// toward the current cycle's required turnover or completed turnover.
//
// Client UX requirement: a player who loses everything and re-deposits
// must see only the NEW deposit's turnover, not the cumulative lifetime
// total. Without this cutoff, depositRequired = SUM(all approved deposits)
// keeps growing forever and the player can never withdraw a fresh deposit
// once they have a long wager history.
async function loadLastBustResetAt(userId: string): Promise<Date | null> {
  try {
    const row = await db.turnoverEvent.findFirst({
      where: { userId, kind: 'auto_loss_reset' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    return row?.createdAt ?? null;
  } catch {
    return null;
  }
}

export async function computeDepositTurnover(userId: string): Promise<DepositTurnoverStatus> {
  const multiplier = await loadDepositTurnoverMultiplier();
  const lastBust = await loadLastBustResetAt(userId);

  // Build the time-bounded WHERE clauses so deposits approved before the
  // bust and wagers placed before the bust don't keep weighing on the
  // current cycle. Bonus grants from before the bust are already cleared
  // by settleLostBonusesIfBust setting status='expired_lost' (excluded
  // from the bpAgg/referralAgg queries below via status: 'active').
  const depositSince = lastBust ? { gt: lastBust } : undefined;
  const betSince = lastBust ? { gt: lastBust } : undefined;

  const [depositAgg, betAgg, bpAgg, referralAgg, spinAgg, registrationAgg, bdtBalanceLocked, referralBalanceLocked, spinBalanceLocked] = await Promise.all([
    db.deposit.aggregate({
      where: {
        userId,
        status: 'approved',
        ...(depositSince ? { reviewedAt: depositSince } : {}),
      },
      _sum: { amount: true },
    }),
    db.providerTransaction.aggregate({
      where: {
        userId,
        status: 'accepted',
        ...(betSince ? { createdAt: betSince } : {}),
      },
      _sum: { betAmount: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: BDT_BALANCE_LOCK_SOURCE_TYPES } },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: REFERRAL_LOCK_SOURCE_TYPES } },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: SPIN_LOCK_SOURCE_TYPES } },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    db.userBonus.aggregate({
      where: { userId, status: 'active', sourceType: { in: REGISTRATION_LOCK_SOURCE_TYPES } },
      _sum: { turnoverRequired: true, turnoverProgress: true },
    }),
    computeBdtBalanceLocked(userId),
    computeReferralBalanceLocked(userId),
    computeSpinBalanceLocked(userId),
  ]);

  const approvedDepositTotal = Number(depositAgg._sum?.amount ?? 0);
  const depositCompleted = Math.abs(Number(betAgg._sum?.betAmount ?? 0));
  const depositRequired = approvedDepositTotal * multiplier;
  const depositRemaining = Math.max(0, depositRequired - depositCompleted);

  const bettingPassRequired = Math.max(0, Number(bpAgg._sum?.turnoverRequired ?? 0));
  const bettingPassCompleted = Math.max(0, Math.min(bettingPassRequired, Number(bpAgg._sum?.turnoverProgress ?? 0)));
  const bettingPassRemaining = Math.max(0, bettingPassRequired - bettingPassCompleted);

  const referralRequired = Math.max(0, Number(referralAgg._sum?.turnoverRequired ?? 0));
  const referralCompleted = Math.max(0, Math.min(referralRequired, Number(referralAgg._sum?.turnoverProgress ?? 0)));
  const referralRemaining = Math.max(0, referralRequired - referralCompleted);

  const spinRequired = Math.max(0, Number(spinAgg._sum?.turnoverRequired ?? 0));
  const spinCompleted = Math.max(0, Math.min(spinRequired, Number(spinAgg._sum?.turnoverProgress ?? 0)));
  const spinRemaining = Math.max(0, spinRequired - spinCompleted);

  const registrationRequired = Math.max(0, Number(registrationAgg._sum?.turnoverRequired ?? 0));
  const registrationCompleted = Math.max(0, Math.min(registrationRequired, Number(registrationAgg._sum?.turnoverProgress ?? 0)));
  const registrationRemaining = Math.max(0, registrationRequired - registrationCompleted);

  const requiredTurnover = depositRequired + bettingPassRequired + referralRequired + spinRequired + registrationRequired;
  // Cap each gate's contribution to its own required value when summing
  // the aggregate "Completed" headline. The raw depositCompleted is the
  // lifetime wager total, which can easily exceed depositRequired - if
  // we let it through unbounded, the headline showed completed=5,905
  // with required=1,500 (visually nonsense) while a downstream gate
  // still had 500 outstanding.
  const completedTurnover =
    Math.min(depositRequired, depositCompleted) + bettingPassCompleted + referralCompleted + spinCompleted + registrationCompleted;
  // The aggregate remaining must be the SUM of unmet sub-gates, not the
  // shortfall on the combined totals. When the deposit gate is overcompleted
  // the old "requiredTurnover - completedTurnover" math could go negative on
  // the betting pass gate and clamp to 0, producing the contradictory "you
  // need 0 more turnover" copy while the betting pass sub-block still
  // showed 500 remaining.
  const remainingTurnover = depositRemaining + bettingPassRemaining + referralRemaining + spinRemaining + registrationRemaining;
  // Gate is met only when BOTH gates are individually met. We could
  // also check remainingTurnover <= 0 but the per-source check is
  // more honest when the deposit gate completed > deposit required
  // (the player over-wagered for deposits but still owes BP wager).
  const isMet = depositRemaining <= 0 && bettingPassRemaining <= 0 && referralRemaining <= 0 && spinRemaining <= 0 && registrationRemaining <= 0;

  return {
    multiplier,
    approvedDepositTotal,
    depositRequired,
    depositCompleted,
    depositRemaining,
    bettingPassRequired,
    bettingPassCompleted,
    bettingPassRemaining,
    referralRequired,
    referralCompleted,
    referralRemaining,
    spinRequired,
    spinCompleted,
    spinRemaining,
    registrationRequired,
    registrationCompleted,
    registrationRemaining,
    requiredTurnover,
    completedTurnover,
    remainingTurnover,
    isMet,
    bdtBalanceLocked,
    referralBalanceLocked,
    spinBalanceLocked,
  };
}
