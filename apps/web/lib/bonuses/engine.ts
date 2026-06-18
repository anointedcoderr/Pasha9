// Built by Anointed Coder.
//
// M2D Bonus + Turnover Engine.
//
// Responsibilities:
//   - Grant lifecycle (issue -> wager -> release | expire | cancel)
//   - Locked-balance accounting on Wallet.bonusBalance + lockedBalance
//   - Eligibility for deposit-trigger bonuses (welcome / deposit_match / reload)
//   - Manual admin grants
//   - Turnover accrual (decrement requirement on bet/wager events)
//   - Expiry sweep (forfeit unfinished grants past their deadline)
//
// M2D hotfix: every skipped rule is recorded with a reason string,
// engine returns an `error` field instead of throwing silently, and
// applyDepositBonuses runs in its own short transactions per grant
// (NOT inside the caller's deposit transaction). That way a bonus
// failure neither rolls back the deposit nor disappears - it is
// surfaced to the approve route which writes it to ActivityLog and
// returns it in the API response.

import { Prisma } from '@prisma/client';
import type { BonusRule, BonusType, ContentStatus } from '@prisma/client';
import { db } from '@/lib/db/client';

type Tx = Prisma.TransactionClient;

// ---------- Helpers ----------

function dec(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function nowPlusDays(days: number): Date | null {
  if (!days || days <= 0) return null;
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function ruleIsActiveNow(rule: BonusRule, at: Date = new Date()): boolean {
  if (rule.status !== 'active') return false;
  if (rule.startsAt && rule.startsAt > at) return false;
  if (rule.endsAt && rule.endsAt < at) return false;
  return true;
}

function computeDepositPayout(rule: BonusRule, depositAmount: Prisma.Decimal): Prisma.Decimal {
  const pct = new Prisma.Decimal(rule.percentage ?? 0);
  const flat = new Prisma.Decimal(rule.amount ?? 0);
  const cap = new Prisma.Decimal(rule.maxBonus ?? 0);
  const fromPct = depositAmount.mul(pct).div(100);
  let total = fromPct.add(flat);
  if (cap.gt(0) && total.gt(cap)) total = cap;
  if (total.lt(0)) return new Prisma.Decimal(0);
  return total;
}

function isMeetingMinDeposit(rule: BonusRule, depositAmount: Prisma.Decimal): boolean {
  const min = new Prisma.Decimal(rule.minDeposit ?? 0);
  if (min.lte(0)) return true;
  return depositAmount.gte(min);
}

function isMatchingWeekday(rule: BonusRule, at: Date): boolean {
  const meta = (rule.meta ?? null) as { weekdays?: unknown } | null;
  if (!meta || !Array.isArray(meta.weekdays) || meta.weekdays.length === 0) return true;
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const today = map[at.getDay()];
  return meta.weekdays.some((w) => typeof w === 'string' && w.toLowerCase() === today);
}

// ---------- Wallet plumbing ----------

// `sourceType` tells the release path whether to move money. Most
// grants live in lockedBalance and need lockedBalance -> balance on
// release. Sources in this set are credited DIRECTLY to balance at
// grant time and tracked via a UserBonus row that the withdrawal
// gate sees and subtracts from withdrawable funds; their release
// must NOT touch the wallet again or lockedBalance / balance would
// drift. The flag is opt-in: anything else keeps the historical
// bonusBalance + lockedBalance move.
//
// Deposit-bonus sources ('deposit' from applyDepositBonuses,
// 'promotion_deposit' from the selected-promotion claim, and
// 'promotion_claim' for after-the-fact admin claims) were moved into
// this set per client request: the user should see the bonus credited
// to their main BDT balance immediately after deposit approval rather
// than sitting in a separate bonusBalance pool. The withdrawal gate
// (lib/turnover/deposit-gate.ts) recognises the same source types and
// keeps the granted amount locked until turnover is met, so this
// change preserves the existing turnover semantics while matching
// the client's "wallet shows 1500" expectation.
const DIRECT_BALANCE_LOCK_SOURCES = new Set([
  'betting_pass_bdt',
  'referral_first_deposit',
  'referral_commission',
  // Deposit-bonus family - credit lands in balance, withdrawal gate
  // enforces the turnover lock via UserBonus aggregation.
  'deposit',
  'promotion_deposit',
  'promotion_claim',
  // Manual admin-issued bonuses land in balance too so the operator
  // can hand-grant a cash bonus that shows up immediately.
  'manual',
  // Cashback campaigns credit Wallet.balance with a turnover lock
  // tracked via UserBonus (matching the spin cash-payout pattern).
  // Without this entry the legacy grantBonusInTx path would have
  // routed cashback into bonusBalance + lockedBalance, which is why
  // operators reported "cashback not added to user balance".
  'cashback_campaign',
]);

async function creditBonus(tx: Tx, userId: string, amount: Prisma.Decimal, sourceType: string | null = null): Promise<void> {
  const direct = sourceType !== null && DIRECT_BALANCE_LOCK_SOURCES.has(sourceType);
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (wallet) {
    await tx.wallet.update({
      where: { userId },
      data: direct
        ? { balance: { increment: amount } }
        : {
            bonusBalance: { increment: amount },
            lockedBalance: { increment: amount },
          },
    });
  } else {
    await tx.wallet.create({
      data: direct
        ? { userId, balance: amount, bonusBalance: 0, lockedBalance: 0 }
        : { userId, bonusBalance: amount, lockedBalance: amount },
    });
  }
}

async function releaseBonus(tx: Tx, userId: string, amount: Prisma.Decimal, sourceType: string | null = null): Promise<void> {
  if (sourceType && DIRECT_BALANCE_LOCK_SOURCES.has(sourceType)) {
    return;
  }
  await tx.wallet.update({
    where: { userId },
    data: {
      lockedBalance: { decrement: amount },
      balance: { increment: amount },
    },
  });
}

async function clawbackBonus(tx: Tx, userId: string, amount: Prisma.Decimal, sourceType: string | null = null): Promise<void> {
  if (sourceType && DIRECT_BALANCE_LOCK_SOURCES.has(sourceType)) {
    await tx.wallet.update({
      where: { userId },
      data: { balance: { decrement: amount } },
    });
    return;
  }
  await tx.wallet.update({
    where: { userId },
    data: {
      bonusBalance: { decrement: amount },
      lockedBalance: { decrement: amount },
    },
  });
}

// ---------- Grant ----------

export interface GrantOpts {
  userId: string;
  rule: BonusRule;
  amount: Prisma.Decimal;
  sourceType: string;
  sourceId?: string | null;
  note?: string | null;
}

export async function grantBonusInTx(tx: Tx, opts: GrantOpts): Promise<{ grantId: string; amount: Prisma.Decimal } | null> {
  const amount = opts.amount;
  if (amount.lte(0)) return null;
  const turnoverX = new Prisma.Decimal(opts.rule.turnoverX ?? 0);
  const turnoverRequired = amount.mul(turnoverX);
  const expiresAt = nowPlusDays(opts.rule.validityDays ?? 0);

  const grant = await tx.userBonus.create({
    data: {
      userId: opts.userId,
      bonusRuleId: opts.rule.id,
      amount,
      expiresAt,
      status: 'active',
      turnoverRequired,
      turnoverProgress: dec(0),
      sourceType: opts.sourceType,
      sourceId: opts.sourceId ?? null,
      note: opts.note ?? null,
    },
  });

  // Thread the source type through so creditBonus can route the
  // deposit-bonus family (deposit / promotion_deposit / promotion_claim
  // / manual) into Wallet.balance directly per the client product
  // direction (visible bonus on the homepage balance pill).
  await creditBonus(tx, opts.userId, amount, opts.sourceType ?? null);

  await tx.transaction.create({
    data: {
      userId: opts.userId,
      type: 'bonus',
      status: 'completed',
      amount,
      reference: grant.id,
      description: `Bonus: ${opts.rule.name}`,
      meta: {
        bonusGrantId: grant.id,
        bonusRuleId: opts.rule.id,
        ruleType: opts.rule.type,
        sourceType: opts.sourceType,
        sourceId: opts.sourceId ?? null,
      } as Prisma.JsonObject,
    },
  });

  if (turnoverRequired.lte(0)) {
    await releaseBonus(tx, opts.userId, amount, opts.sourceType ?? null);
    await tx.userBonus.update({
      where: { id: grant.id },
      data: { status: 'completed', releasedAt: new Date() },
    });
  }

  return { grantId: grant.id, amount };
}

// ---------- Deposit hook ----------

export interface DepositGrantSummary {
  ruleId: string;
  ruleName: string;
  ruleType: BonusType;
  ruleCode: string | null;
  grantId: string;
  amount: number;
  turnoverRequired: number;
}
export interface DepositSkipSummary {
  ruleId: string;
  ruleName: string;
  ruleType: BonusType;
  ruleCode: string | null;
  reason: string;
}
export interface ApplyDepositResult {
  granted: DepositGrantSummary[];
  skipped: DepositSkipSummary[];
  candidateCount: number;
  error: string | null;
  isFirstDeposit: boolean;
}

// Pure evaluation: returns the per-rule decision for a given deposit
// without actually granting. Shared by applyDepositBonuses and the
// /diagnose endpoint.
async function evaluateDepositCandidates(
  userId: string,
  depositId: string | null,
  depositAmount: Prisma.Decimal,
): Promise<{ rule: BonusRule; payout: Prisma.Decimal; eligible: boolean; reason: string | null; isFirstDeposit: boolean; candidateCount: number }[]> {
  const at = new Date();

  // approvedCount counts deposits the user has had approved INCLUDING
  // the current one, since the approve route updates the deposit row
  // before calling the engine (engine runs after the deposit
  // transaction commits in the hotfixed flow).
  const approvedCount = await db.deposit.count({
    where: { userId, status: 'approved' },
  });
  const isFirstDeposit = approvedCount <= 1;

  // Pull every potentially-relevant rule in one go and decide in JS.
  // Keeps the SQL simple and the diagnostics easy to surface.
  const triggers: BonusType[] = ['first_deposit', 'reload', 'promo'];
  const all = await db.bonusRule.findMany({
    where: { type: { in: triggers }, status: 'active' as ContentStatus },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  // De-dupe by trigger type within the same call so two welcome
  // bonuses do not both fire.
  const seenTypes = new Set<BonusType>();
  const results: { rule: BonusRule; payout: Prisma.Decimal; eligible: boolean; reason: string | null; isFirstDeposit: boolean; candidateCount: number }[] = [];

  for (const rule of all) {
    const reasons: string[] = [];

    if (!ruleIsActiveNow(rule, at)) reasons.push('rule_window_inactive');
    if (!isMatchingWeekday(rule, at)) reasons.push('weekday_mismatch');
    if (!isMeetingMinDeposit(rule, depositAmount)) reasons.push(`min_deposit_${Number(rule.minDeposit)}_not_met`);

    if (rule.type === 'first_deposit' && !isFirstDeposit) {
      reasons.push('not_first_deposit');
    }
    if (rule.type === 'first_deposit') {
      const existing = await db.userBonus.count({
        where: { userId, bonusRule: { type: 'first_deposit' }, ...(depositId ? { NOT: { sourceId: depositId } } : {}) },
      });
      if (existing > 0) reasons.push('first_deposit_already_used');
    }
    if (rule.type === 'promo') {
      const meta = (rule.meta ?? null) as { trigger?: string } | null;
      if (!meta || meta.trigger !== 'deposit') reasons.push('promo_not_deposit_triggered');
    }
    if (rule.type === 'reload' && rule.startsAt == null && rule.endsAt == null) {
      // Reload rules without a window apply every deposit - this is
      // intentional, no extra check needed.
    }

    const payout = computeDepositPayout(rule, depositAmount);
    if (payout.lte(0)) reasons.push('computed_payout_zero');

    if (seenTypes.has(rule.type)) reasons.push('lower_priority_of_same_type');

    const eligible = reasons.length === 0;
    if (eligible) seenTypes.add(rule.type);

    results.push({
      rule,
      payout,
      eligible,
      reason: eligible ? null : reasons.join('|'),
      isFirstDeposit,
      candidateCount: all.length,
    });
  }

  return results;
}

export async function applyDepositBonuses(
  userId: string,
  depositId: string,
  depositAmount: Prisma.Decimal,
): Promise<ApplyDepositResult> {
  const result: ApplyDepositResult = {
    granted: [],
    skipped: [],
    candidateCount: 0,
    error: null,
    isFirstDeposit: false,
  };

  let evaluated: Awaited<ReturnType<typeof evaluateDepositCandidates>>;
  try {
    evaluated = await evaluateDepositCandidates(userId, depositId, depositAmount);
  } catch (err) {
    const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
    console.error('[bonus] evaluation failed', msg);
    result.error = `eval_failed: ${msg.slice(0, 500)}`;
    return result;
  }

  result.candidateCount = evaluated.length;
  result.isFirstDeposit = evaluated[0]?.isFirstDeposit ?? false;

  if (evaluated.length === 0) {
    console.info('[bonus] no active rules found for deposit', { userId, depositId });
  }

  for (const ev of evaluated) {
    if (!ev.eligible) {
      result.skipped.push({
        ruleId: ev.rule.id,
        ruleName: ev.rule.name,
        ruleType: ev.rule.type,
        ruleCode: ev.rule.code ?? null,
        reason: ev.reason ?? 'unknown',
      });
      console.info('[bonus] skip', { ruleId: ev.rule.id, ruleName: ev.rule.name, reason: ev.reason });
      continue;
    }

    try {
      const grant = await db.$transaction(async (tx) => {
        return grantBonusInTx(tx, {
          userId,
          rule: ev.rule,
          amount: ev.payout,
          sourceType: 'deposit',
          sourceId: depositId,
        });
      });

      if (grant) {
        const turnoverRequired = ev.payout.mul(new Prisma.Decimal(ev.rule.turnoverX ?? 0));
        result.granted.push({
          ruleId: ev.rule.id,
          ruleName: ev.rule.name,
          ruleType: ev.rule.type,
          ruleCode: ev.rule.code ?? null,
          grantId: grant.grantId,
          amount: Number(grant.amount),
          turnoverRequired: Number(turnoverRequired),
        });
        console.info('[bonus] granted', {
          ruleId: ev.rule.id,
          ruleName: ev.rule.name,
          userId,
          amount: Number(grant.amount),
          turnoverRequired: Number(turnoverRequired),
        });
      } else {
        result.skipped.push({
          ruleId: ev.rule.id,
          ruleName: ev.rule.name,
          ruleType: ev.rule.type,
          ruleCode: ev.rule.code ?? null,
          reason: 'grant_returned_null',
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err);
      console.error('[bonus] grant failed', { ruleId: ev.rule.id, ruleName: ev.rule.name }, msg);
      result.skipped.push({
        ruleId: ev.rule.id,
        ruleName: ev.rule.name,
        ruleType: ev.rule.type,
        ruleCode: ev.rule.code ?? null,
        reason: `grant_failed: ${msg.slice(0, 300)}`,
      });
      result.error = result.error ?? `grant_failed: ${msg.slice(0, 300)}`;
    }
  }

  return result;
}

// Dry-run for the diagnose endpoint. Returns the same shape as
// evaluateDepositCandidates plus a serializable summary.
export async function diagnoseDeposit(
  userId: string,
  depositAmount: number,
): Promise<{
  isFirstDeposit: boolean;
  candidateCount: number;
  evaluated: Array<{
    ruleId: string;
    ruleName: string;
    ruleType: BonusType;
    ruleCode: string | null;
    status: string;
    eligible: boolean;
    reason: string | null;
    payout: number;
    turnoverRequired: number;
  }>;
  walletExists: boolean;
}> {
  const amount = new Prisma.Decimal(depositAmount);
  const evaluated = await evaluateDepositCandidates(userId, null, amount);
  const wallet = await db.wallet.findUnique({ where: { userId }, select: { id: true } });
  return {
    isFirstDeposit: evaluated[0]?.isFirstDeposit ?? true,
    candidateCount: evaluated.length,
    walletExists: !!wallet,
    evaluated: evaluated.map((e) => ({
      ruleId: e.rule.id,
      ruleName: e.rule.name,
      ruleType: e.rule.type,
      ruleCode: e.rule.code ?? null,
      status: e.rule.status,
      eligible: e.eligible,
      reason: e.reason,
      payout: Number(e.payout),
      turnoverRequired: Number(e.payout.mul(new Prisma.Decimal(e.rule.turnoverX ?? 0))),
    })),
  };
}

// ---------- Manual grant ----------

export interface ManualGrantOpts {
  userId: string;
  ruleId: string;
  amount: number;
  note?: string;
  actorId?: string;
}

export async function manualGrant(opts: ManualGrantOpts): Promise<{ grantId: string; amount: number } | null> {
  const rule = await db.bonusRule.findUnique({ where: { id: opts.ruleId } });
  if (!rule) throw new Error('RULE_NOT_FOUND');
  if (rule.status !== 'active') throw new Error('RULE_INACTIVE');
  const user = await db.user.findUnique({ where: { id: opts.userId }, select: { id: true, status: true } });
  if (!user) throw new Error('USER_NOT_FOUND');
  if (user.status === 'blocked') throw new Error('USER_BLOCKED');

  const amount = new Prisma.Decimal(opts.amount);
  if (amount.lte(0)) throw new Error('AMOUNT_INVALID');

  return await db.$transaction(async (tx) => {
    const r = await grantBonusInTx(tx, {
      userId: opts.userId,
      rule,
      amount,
      sourceType: 'manual',
      sourceId: opts.actorId ?? null,
      note: opts.note ?? null,
    });
    return r ? { grantId: r.grantId, amount: Number(r.amount) } : null;
  });
}

// ---------- Turnover ----------

export interface AddTurnoverOpts {
  userId: string;
  amount: number;
  kind: string;
  reference?: string;
  meta?: Prisma.JsonObject;
}

export async function addTurnover(opts: AddTurnoverOpts): Promise<{
  applied: Array<{ grantId: string; appliedAmount: number; progressAfter: number; required: number; released: boolean }>;
  unallocated: number;
}> {
  const wager = new Prisma.Decimal(opts.amount);
  if (wager.lte(0)) return { applied: [], unallocated: 0 };

  return await db.$transaction(async (tx) => {
    const grants = await tx.userBonus.findMany({
      where: { userId: opts.userId, status: 'active' },
      orderBy: { claimedAt: 'asc' },
    });

    let remaining = wager;
    const applied: Array<{ grantId: string; appliedAmount: number; progressAfter: number; required: number; released: boolean }> = [];

    for (const g of grants) {
      if (remaining.lte(0)) break;
      const required = new Prisma.Decimal(g.turnoverRequired);
      const progress = new Prisma.Decimal(g.turnoverProgress);
      const need = required.sub(progress);
      if (need.lte(0)) continue;

      const apply = remaining.gte(need) ? need : remaining;
      const progressAfter = progress.add(apply);
      const released = progressAfter.gte(required);
      remaining = remaining.sub(apply);

      await tx.userBonus.update({
        where: { id: g.id },
        data: {
          turnoverProgress: progressAfter,
          ...(released ? { status: 'completed', releasedAt: new Date() } : {}),
        },
      });

      await tx.turnoverEvent.create({
        data: {
          userId: opts.userId,
          bonusGrantId: g.id,
          amount: apply,
          kind: opts.kind,
          reference: opts.reference ?? null,
          meta: (opts.meta ?? null) as Prisma.InputJsonValue,
        },
      });

      if (released) {
        await releaseBonus(tx, opts.userId, new Prisma.Decimal(g.amount), g.sourceType ?? null);
      }

      applied.push({
        grantId: g.id,
        appliedAmount: Number(apply),
        progressAfter: Number(progressAfter),
        required: Number(required),
        released,
      });
    }

    if (remaining.gt(0)) {
      await tx.turnoverEvent.create({
        data: {
          userId: opts.userId,
          bonusGrantId: null,
          amount: remaining,
          kind: opts.kind,
          reference: opts.reference ?? null,
          meta: (opts.meta ?? null) as Prisma.InputJsonValue,
        },
      });
    }

    // After every wager, settle out any active grants if the player
    // has wagered their entire balance down to zero. Operators
    // reported the legacy carry-forward behaviour as a serious UX
    // bug.
    try {
      await settleLostBonusesIfBust(tx, opts.userId);
    } catch (err) {
      console.error('[addTurnover] settleLostBonusesIfBust failed', err);
    }

    return { applied, unallocated: Number(remaining) };
  }).then(async (result) => {
    // Betting Pass bet-points accrual runs outside the bonus
    // transaction so a Betting Pass failure can never roll back the
    // bonus progress. Idempotency on BettingPassEvent prevents
    // double-awarding when the caller retries.
    if (opts.reference) {
      try {
        const { accrueBettingPassOnBet } = await import('@/lib/betting-pass/engine');
        await accrueBettingPassOnBet(opts.userId, opts.reference, Number(opts.amount));
      } catch (err) {
        console.error('[addTurnover] betting-pass bet accrual failed', err);
      }
    }
    return result;
  });
}

// ---------- Loss reset ----------
//
// When a player has wagered down to a zero balance across every
// wallet column, any active UserBonus turnover requirement is moot -
// they have no money left to wager. Operators reported the legacy
// behaviour (carry forward the unmet turnover requirement onto the
// next deposit) as a serious UX problem: a player who lost the full
// bonus + their own balance would then deposit again and immediately
// be told "you still owe 8,500 BDT turnover from the previous round."
//
// This helper closes every active UserBonus row for the user with
// status='expired_lost' (a new dedicated value, distinct from
// status='expired' which represents time-based expiry) and stamps
// turnoverProgress = turnoverRequired so the deposit-gate aggregation
// shows the turnover as satisfied. Idempotent: a user whose wallet is
// zero and who has no active grants is a no-op.
export async function settleLostBonusesIfBust(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ closed: number }> {
  const wallet = await tx.wallet.findUnique({
    where: { userId },
    select: { balance: true, bonusBalance: true, lockedBalance: true },
  });
  if (!wallet) return { closed: 0 };
  const total = new Prisma.Decimal(wallet.balance)
    .add(new Prisma.Decimal(wallet.bonusBalance))
    .add(new Prisma.Decimal(wallet.lockedBalance));
  // Use < 1 BDT as the threshold so a sub-paisa rounding remnant does
  // not keep the turnover lock alive forever.
  if (total.gte(new Prisma.Decimal(1))) return { closed: 0 };

  const active = await tx.userBonus.findMany({
    where: { userId, status: 'active' },
    select: { id: true, turnoverRequired: true, turnoverProgress: true, amount: true, sourceType: true },
  });
  if (active.length === 0) return { closed: 0 };

  const now = new Date();
  for (const g of active) {
    await tx.userBonus.update({
      where: { id: g.id },
      data: {
        status: 'expired_lost',
        turnoverProgress: g.turnoverRequired,
        releasedAt: now,
        note: 'Auto-closed: player wagered the entire bonus + balance to zero.',
      },
    });
    await tx.turnoverEvent.create({
      data: {
        userId,
        bonusGrantId: g.id,
        amount: new Prisma.Decimal(g.turnoverRequired).sub(new Prisma.Decimal(g.turnoverProgress)),
        kind: 'auto_loss_reset',
        meta: { sourceType: g.sourceType ?? null, grantAmount: Number(g.amount) } as Prisma.InputJsonValue,
      },
    });
  }
  return { closed: active.length };
}

// ---------- Cancel ----------

export async function cancelGrant(grantId: string, actorNote?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const g = await tx.userBonus.findUnique({ where: { id: grantId } });
    if (!g) throw new Error('GRANT_NOT_FOUND');
    if (g.status !== 'active') throw new Error('GRANT_NOT_ACTIVE');
    if (g.sourceType === 'referral_first_deposit' || g.sourceType === 'referral_commission') {
      throw new Error('REFERRAL_LOCK_MANAGED_BY_REFERRAL_LEDGER');
    }

    await tx.userBonus.update({
      where: { id: grantId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        note: actorNote ?? g.note ?? null,
      },
    });
    await clawbackBonus(tx, g.userId, new Prisma.Decimal(g.amount), g.sourceType ?? null);
    await tx.transaction.create({
      data: {
        userId: g.userId,
        type: 'adjust',
        status: 'completed',
        amount: new Prisma.Decimal(g.amount).neg(),
        reference: grantId,
        description: 'Bonus grant cancelled',
        meta: { bonusGrantId: grantId, reason: actorNote ?? 'admin_cancel' } as Prisma.JsonObject,
      },
    });
  });
}

// ---------- Expiry sweep ----------

export async function sweepExpiredGrants(): Promise<{ expired: number }> {
  const now = new Date();
  const candidates = await db.userBonus.findMany({
    where: { status: 'active', expiresAt: { lt: now, not: null } },
    select: { id: true, userId: true, amount: true, sourceType: true },
  });
  let expired = 0;
  for (const g of candidates) {
    try {
      await db.$transaction(async (tx) => {
        const fresh = await tx.userBonus.findUnique({ where: { id: g.id }, select: { status: true } });
        if (!fresh || fresh.status !== 'active') return;
        await tx.userBonus.update({
          where: { id: g.id },
          data: { status: 'expired' },
        });
        await clawbackBonus(tx, g.userId, new Prisma.Decimal(g.amount), g.sourceType ?? null);
        await tx.transaction.create({
          data: {
            userId: g.userId,
            type: 'adjust',
            status: 'completed',
            amount: new Prisma.Decimal(g.amount).neg(),
            reference: g.id,
            description: 'Bonus expired (turnover not completed in time)',
            meta: { bonusGrantId: g.id, reason: 'expired' } as Prisma.JsonObject,
          },
        });
      });
      expired += 1;
    } catch (err) {
      console.error('bonus expire failed for', g.id, err);
    }
  }
  return { expired };
}
