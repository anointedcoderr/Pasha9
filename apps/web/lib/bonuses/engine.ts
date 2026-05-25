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
// All write helpers expect a Prisma transaction handle so they can be
// composed inside the deposit-approve transaction without leaking
// partial wallet state.

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

// Returns the bonus payout for a given deposit amount under a rule.
// percentage is a 0-100 number applied to the deposit, then clamped
// by maxBonus (0 = unlimited). amount (flat) is added on top.
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

// Weekday filter via rule.meta.weekdays: ["mon","tue",...]. If absent,
// rule applies any day.
function isMatchingWeekday(rule: BonusRule, at: Date): boolean {
  const meta = (rule.meta ?? null) as { weekdays?: unknown } | null;
  if (!meta || !Array.isArray(meta.weekdays) || meta.weekdays.length === 0) return true;
  const map = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
  const today = map[at.getDay()];
  return meta.weekdays.some((w) => typeof w === 'string' && w.toLowerCase() === today);
}

// ---------- Wallet plumbing ----------

async function creditBonus(tx: Tx, userId: string, amount: Prisma.Decimal): Promise<void> {
  const wallet = await tx.wallet.findUnique({ where: { userId } });
  if (wallet) {
    await tx.wallet.update({
      where: { userId },
      data: {
        bonusBalance: { increment: amount },
        lockedBalance: { increment: amount },
      },
    });
  } else {
    await tx.wallet.create({
      data: {
        userId,
        bonusBalance: amount,
        lockedBalance: amount,
      },
    });
  }
}

async function releaseBonus(tx: Tx, userId: string, amount: Prisma.Decimal): Promise<void> {
  // Locked funds become spendable: locked -= amount, main += amount.
  // bonusBalance stays (it tracks lifetime granted bonus, not just
  // the locked portion - keeps accounting simple for reports).
  await tx.wallet.update({
    where: { userId },
    data: {
      lockedBalance: { decrement: amount },
      balance: { increment: amount },
    },
  });
}

async function clawbackBonus(tx: Tx, userId: string, amount: Prisma.Decimal): Promise<void> {
  // Used on expire / cancel. Decrements both bonusBalance and
  // lockedBalance so the funds simply disappear (never reach main).
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

  await creditBonus(tx, opts.userId, amount);

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

  // Turnover requirement = 0 means the bonus is free (no wagering
  // required) and should release immediately so the user sees it in
  // main balance straight away.
  if (turnoverRequired.lte(0)) {
    await releaseBonus(tx, opts.userId, amount);
    await tx.userBonus.update({
      where: { id: grant.id },
      data: { status: 'completed', releasedAt: new Date() },
    });
  }

  return { grantId: grant.id, amount };
}

// ---------- Deposit hook ----------

// Called from /api/admin/deposits/[id]/approve after the main wallet
// credit lands. Picks the most appropriate rule for each trigger
// (highest priority + most-specific match) and grants it. Skips
// rules the user already has open grants for (idempotency).

export interface ApplyDepositResult {
  granted: Array<{ ruleId: string; ruleName: string; ruleType: BonusType; grantId: string; amount: number }>;
  skipped: Array<{ ruleId: string; reason: string }>;
}

export async function applyDepositBonuses(
  tx: Tx,
  userId: string,
  depositId: string,
  depositAmount: Prisma.Decimal,
): Promise<ApplyDepositResult> {
  const result: ApplyDepositResult = { granted: [], skipped: [] };
  const at = new Date();

  // Is this the user's first ever approved deposit? Count includes
  // the current one (it has just been updated to status=approved in
  // the same transaction).
  const approvedCount = await tx.deposit.count({
    where: { userId, status: 'approved' },
  });
  const isFirstDeposit = approvedCount <= 1;

  // Triggers we evaluate, in order. Each maps to a BonusType in the
  // schema. We grant at most one rule per trigger to avoid stacking
  // 5 welcome bonuses if an admin made multiple rules.
  const triggers: BonusType[] = isFirstDeposit
    ? ['first_deposit', 'reload']
    : ['reload'];

  // Generic deposit-match rules use 'promo' type with a meta flag.
  // We treat 'promo' rules with meta.trigger = 'deposit' as
  // recurring deposit match and evaluate them on every deposit.
  triggers.push('promo');

  const allCandidates = await tx.bonusRule.findMany({
    where: { type: { in: triggers }, status: 'active' as ContentStatus },
    orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
  });

  // De-dupe by trigger family so we only grant one rule per kind.
  const grantedTypes = new Set<BonusType>();

  for (const rule of allCandidates) {
    if (grantedTypes.has(rule.type)) continue;
    if (!ruleIsActiveNow(rule, at)) continue;
    if (!isMatchingWeekday(rule, at)) continue;
    if (!isMeetingMinDeposit(rule, depositAmount)) continue;

    // promo rules that are not explicitly a deposit trigger should
    // be skipped here (they are admin/manual grants on the public
    // promotions page).
    if (rule.type === 'promo') {
      const meta = (rule.meta ?? null) as { trigger?: string } | null;
      if (!meta || meta.trigger !== 'deposit') continue;
    }

    // first_deposit guard: skip if user already has a granted
    // first_deposit bonus from any prior path (defensive - the
    // approvedCount check above usually catches this).
    if (rule.type === 'first_deposit') {
      const existing = await tx.userBonus.count({
        where: { userId, bonusRule: { type: 'first_deposit' } },
      });
      if (existing > 0) {
        result.skipped.push({ ruleId: rule.id, reason: 'FIRST_DEPOSIT_ALREADY_USED' });
        continue;
      }
    }

    const payout = computeDepositPayout(rule, depositAmount);
    if (payout.lte(0)) {
      result.skipped.push({ ruleId: rule.id, reason: 'PAYOUT_ZERO' });
      continue;
    }

    const granted = await grantBonusInTx(tx, {
      userId,
      rule,
      amount: payout,
      sourceType: 'deposit',
      sourceId: depositId,
    });
    if (granted) {
      result.granted.push({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.type,
        grantId: granted.grantId,
        amount: Number(granted.amount),
      });
      grantedTypes.add(rule.type);
    }
  }

  return result;
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

// Distributes a wager amount across the user's active grants in
// FIFO order (oldest first). Releases any grant whose requirement is
// met. Returns the per-grant breakdown so callers can surface what
// changed.
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
        await releaseBonus(tx, opts.userId, new Prisma.Decimal(g.amount));
      }

      applied.push({
        grantId: g.id,
        appliedAmount: Number(apply),
        progressAfter: Number(progressAfter),
        required: Number(required),
        released,
      });
    }

    // Unallocated wager (no active grants OR all already satisfied)
    // gets logged as a userId-only event for auditability.
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

    return { applied, unallocated: Number(remaining) };
  });
}

// ---------- Cancel ----------

export async function cancelGrant(grantId: string, actorNote?: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const g = await tx.userBonus.findUnique({ where: { id: grantId } });
    if (!g) throw new Error('GRANT_NOT_FOUND');
    if (g.status !== 'active') throw new Error('GRANT_NOT_ACTIVE');

    await tx.userBonus.update({
      where: { id: grantId },
      data: {
        status: 'cancelled',
        cancelledAt: new Date(),
        note: actorNote ?? g.note ?? null,
      },
    });
    await clawbackBonus(tx, g.userId, new Prisma.Decimal(g.amount));
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

// Called from a cron / admin tool. Forfeits any active grants whose
// expiresAt is in the past. Returns the count of grants expired so
// the caller can surface it in the audit log.
export async function sweepExpiredGrants(): Promise<{ expired: number }> {
  const now = new Date();
  const candidates = await db.userBonus.findMany({
    where: { status: 'active', expiresAt: { lt: now, not: null } },
    select: { id: true, userId: true, amount: true },
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
        await clawbackBonus(tx, g.userId, new Prisma.Decimal(g.amount));
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
