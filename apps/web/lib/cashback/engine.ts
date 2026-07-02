// Built by Anointed Coder.
//
// Cashback engine. For a given CashbackCampaign and period window,
// computes the eligible base (net loss or total wager) per user from
// the Transaction ledger, applies the configured percentage and cap,
// and credits each eligible player as REAL BDT in Wallet.balance,
// tracked by a UserBonus row that the withdrawal gate enforces if the
// campaign carries a positive turnoverX.
//
// Crediting model (matches the spin cash-payout pattern at
// app/api/rewards/spin/route.ts:204-248):
//   1. Credit Wallet.balance directly with the cashback amount
//   2. Create a UserBonus row with sourceType='cashback_campaign',
//      turnoverRequired = cashback * campaign.turnoverX
//   3. Write a Transaction row of type 'bonus' so the player sees it
//      in the wallet history
//   4. Create a Notification + NotificationRecipient row with kind=
//      'cashback' so the player-side CashbackCelebration popup fires
//      on the next page load
//
// Scope filter:
//   campaign.scopeType = 'all'   -> sum every completed bet/win in the
//                                   window (default, original behaviour)
//   campaign.scopeType = 'match' -> filter Transaction.meta.scope to
//                                   the operator-supplied scopeKeys
//                                   ('casino', 'sports', 'live_casino',
//                                   'native:dice', etc.). Bet/win
//                                   writers stamp meta.scope at write
//                                   time (native games stamp 'casino';
//                                   external providers stamp their own
//                                   scope when integrated).
//
// CashbackPayout.idempotencyKey blocks a double-payout for the same
// (campaign, user, period) combination.
//
// Dry-run mode (input.dryRun = true): performs the exact same window,
// scope, base, percentage, cap and already-paid computation, but writes
// NOTHING. No BonusRule upsert, no db.$transaction is ever opened, no
// CashbackPayout / Wallet / UserBonus / Transaction / Notification /
// ActivityLog row is touched. The result carries dryRun: true and the
// per-user lines show what WOULD be paid.

import { Prisma, TxType } from '@prisma/client';
import { db } from '@/lib/db/client';

export interface CashbackRunInput {
  campaignId: string;
  periodStart?: Date;
  periodEnd?: Date;
  actorId?: string | null;
  actorRole?: string | null;
  // When true the engine only reads and computes: identical eligibility
  // scan and per-user math, zero database writes.
  dryRun?: boolean;
}

export interface CashbackPayoutLine {
  userId: string;
  baseAmount: number;
  cashbackAmount: number;
  status: 'granted' | 'skipped_zero' | 'skipped_duplicate' | 'failed';
  payoutId?: string | null;
  error?: string;
}

export interface CashbackRunResult {
  campaignId: string;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  eligibleUsers: number;
  paidUsers: number;
  totalCashback: number;
  lines: CashbackPayoutLine[];
  // True when this result came from a preview run: nothing was written,
  // paidUsers/totalCashback describe what WOULD be paid.
  dryRun: boolean;
}

const dec = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

export function periodKeyFor(cadence: string, end: Date): string {
  const y = end.getUTCFullYear();
  const m = String(end.getUTCMonth() + 1).padStart(2, '0');
  const d = String(end.getUTCDate()).padStart(2, '0');
  if (cadence === 'daily') return `${y}-${m}-${d}`;
  if (cadence === 'weekly') {
    // ISO-8601 week. Move to nearest Thursday, then compute year/week.
    const date = new Date(Date.UTC(y, end.getUTCMonth(), end.getUTCDate()));
    const dayNum = date.getUTCDay() === 0 ? 7 : date.getUTCDay();
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }
  if (cadence === 'monthly') return `${y}-${m}`;
  return `${y}-${m}-${d}`;
}

function defaultPeriodWindow(cadence: string, now: Date): { start: Date; end: Date } {
  if (cadence === 'daily') {
    // Floor to UTC calendar midnight so 'daily' means the whole of
    // yesterday: yesterday 00:00 UTC .. today 00:00 UTC. This matches
    // the cron comment and captures every loss booked on the prior day
    // regardless of the run time, removing the eligible=1/paid=0 edge
    // the old rolling now-24h window could hit near a day boundary.
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const start = new Date(end);
    start.setUTCDate(end.getUTCDate() - 1);
    return { start, end };
  }
  const end = new Date(now);
  const start = new Date(now);
  if (cadence === 'monthly') start.setUTCMonth(end.getUTCMonth() - 1);
  else start.setUTCDate(end.getUTCDate() - 7);
  return { start, end };
}

// Format BDT with up to 2 decimals, trimming trailing zeros for nice
// presentation in the celebration popup text. 50 -> "50", 50.5 -> "50.5".
function fmtBdt(amount: Prisma.Decimal): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// Find an existing campaign+user+period row from a previous partial run
// so the engine can resume without re-counting the same period.
async function loadPaidUserIds(campaignId: string, periodKey: string): Promise<Set<string>> {
  const rows = await db.cashbackPayout.findMany({
    where: { campaignId, periodKey },
    select: { userId: true },
  });
  return new Set(rows.map((r) => r.userId));
}

export async function runCashbackCampaign(input: CashbackRunInput): Promise<CashbackRunResult> {
  const campaign = await db.cashbackCampaign.findUnique({
    where: { id: input.campaignId },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (!campaign.isActive) throw new Error('CAMPAIGN_INACTIVE');

  const dryRun = input.dryRun === true;
  const now = new Date();
  const window = (() => {
    if (input.periodStart && input.periodEnd) return { start: input.periodStart, end: input.periodEnd };
    return defaultPeriodWindow(campaign.cadence, now);
  })();
  const periodKey = periodKeyFor(campaign.cadence, window.end);

  // Honour campaign window when set.
  if (campaign.startsAt && window.end < campaign.startsAt) {
    return { campaignId: campaign.id, periodKey, periodStart: window.start, periodEnd: window.end, eligibleUsers: 0, paidUsers: 0, totalCashback: 0, lines: [], dryRun };
  }
  if (campaign.endsAt && window.start > campaign.endsAt) {
    return { campaignId: campaign.id, periodKey, periodStart: window.start, periodEnd: window.end, eligibleUsers: 0, paidUsers: 0, totalCashback: 0, lines: [], dryRun };
  }

  // Stable BonusRule for cashback payouts. Lets the UserBonus row carry
  // a bonusRuleId FK without forcing the operator to hand-create a
  // BonusRule per campaign (the original implementation required this
  // and silently no-op'd when missing, which was the root cause of the
  // "cashback not credited" bug).
  //
  // Skipped entirely on a dry run: the upsert can create a row, and the
  // dry path never reaches the payout transaction that needs the id.
  const bonusRuleId: string | null = dryRun
    ? null
    : (await db.bonusRule.upsert({
        where: { code: 'cashback_payout' },
        update: {},
        create: {
          code: 'cashback_payout',
          name: 'Cashback Reward',
          type: 'manual',
          status: 'active',
          amount: 0,
          turnoverX: 0,
          validityDays: 30,
          description: 'Cashback credited by an admin-defined CashbackCampaign. Locked balance until the per-campaign turnover is met.',
        },
        select: { id: true },
      })).id;

  // Build scope filter. campaign.scopeType='all' -> no extra where
  // clause; 'match' filters Transaction.meta.scope to the configured
  // keys. groupBy does NOT support Json path filters directly, so for
  // scoped campaigns we run a raw findMany instead.
  const scopeKeys = Array.isArray(campaign.scopeKeys) ? campaign.scopeKeys.filter((k) => typeof k === 'string' && k.trim().length > 0) : [];
  const isScoped = campaign.scopeType === 'match' && scopeKeys.length > 0;

  const userTotals = new Map<string, { bet: Prisma.Decimal; win: Prisma.Decimal }>();

  if (!isScoped) {
    // Default path - sum every completed bet/win in the window.
    const grouped = await db.transaction.groupBy({
      by: ['userId', 'type'],
      where: {
        status: 'completed',
        createdAt: { gte: window.start, lte: window.end },
        type: { in: [TxType.bet, TxType.win] },
      },
      _sum: { amount: true },
    });
    for (const row of grouped) {
      const cur = userTotals.get(row.userId) ?? { bet: dec(0), win: dec(0) };
      if (row.type === 'bet') cur.bet = cur.bet.add(dec(row._sum.amount ?? 0));
      if (row.type === 'win') cur.win = cur.win.add(dec(row._sum.amount ?? 0));
      userTotals.set(row.userId, cur);
    }
  } else {
    // Scoped path - pull bet/win rows whose meta.scope is one of the
    // operator-configured keys, then aggregate per user in memory.
    // Prisma's JsonFilter only exposes equals/contains/starts/ends_with;
    // to express "scope is one of N keys" we OR a per-key equality
    // filter. Postgres optimises this into a single jsonb_path_query
    // scan, so the cost is identical to a single SQL `in (...)`.
    const rows = await db.transaction.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: window.start, lte: window.end },
        type: { in: [TxType.bet, TxType.win] },
        OR: scopeKeys.map((key) => ({
          meta: { path: ['scope'], equals: key },
        })),
      },
      select: { userId: true, type: true, amount: true },
    });
    for (const row of rows) {
      const cur = userTotals.get(row.userId) ?? { bet: dec(0), win: dec(0) };
      if (row.type === 'bet') cur.bet = cur.bet.add(dec(row.amount));
      if (row.type === 'win') cur.win = cur.win.add(dec(row.amount));
      userTotals.set(row.userId, cur);
    }
  }

  const percentage = dec(campaign.percentage);
  const maxCashback = dec(campaign.maxCashback);
  const campaignTurnoverX = dec(campaign.turnoverX);
  const lines: CashbackPayoutLine[] = [];
  let paidUsers = 0;
  let totalCashback = dec(0);

  // Pre-load already-paid user IDs for this period so we can short-
  // circuit duplicates without burning a transaction per user.
  const alreadyPaid = await loadPaidUserIds(campaign.id, periodKey);

  for (const [userId, totals] of userTotals.entries()) {
    // Bet amounts are stored negative and wins positive (see
    // native-games/service.ts + providers/wallet.ts), so a losing
    // player's signed ledger is negative. Net loss and total wagered
    // are the negated forms. Without this negation base came out <= 0
    // for every loss, so cashback was always skipped and never paid.
    const base = campaign.source === 'wager_amount'
      ? totals.bet.neg()
      : totals.bet.add(totals.win).neg();
    if (base.lte(0)) {
      lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_zero' });
      continue;
    }
    let cashback = base.mul(percentage).div(100);
    if (maxCashback.gt(0) && cashback.gt(maxCashback)) cashback = maxCashback;
    // Round down to two decimals so we never credit a sub-paisa
    // fraction the wallet column cannot store.
    cashback = cashback.toDecimalPlaces(2, Prisma.Decimal.ROUND_DOWN);
    if (cashback.lte(0)) {
      lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_zero' });
      continue;
    }
    if (alreadyPaid.has(userId)) {
      lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_duplicate' });
      continue;
    }

    // Dry-run exit. This `continue` is the money-safety guarantee: on a
    // preview nothing below this line ever executes, so the
    // db.$transaction block with its create/upsert/update calls is
    // unreachable. We only record what WOULD be paid.
    if (dryRun) {
      paidUsers += 1;
      totalCashback = totalCashback.add(cashback);
      lines.push({
        userId,
        baseAmount: Number(base),
        cashbackAmount: Number(cashback),
        status: 'granted',
        payoutId: null,
      });
      continue;
    }
    // Real-payout path only from here on. bonusRuleId is always set when
    // dryRun is false; this defensive throw also narrows the type.
    if (bonusRuleId === null) throw new Error('BONUS_RULE_MISSING');

    const idempotencyKey = `${campaign.id}:${userId}:${periodKey}`;
    const turnoverRequired = cashback.mul(campaignTurnoverX);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    try {
      const payout = await db.$transaction(async (tx) => {
        // 1. Idempotency anchor. CashbackPayout.idempotencyKey is unique;
        //    a concurrent run with the same key throws P2002 below.
        const created = await tx.cashbackPayout.create({
          data: {
            campaignId: campaign.id,
            userId,
            periodKey,
            baseAmount: base,
            cashbackAmount: cashback,
            status: 'granted',
            idempotencyKey,
          },
        });

        // 2. Credit REAL BDT into Wallet.balance. The withdrawal gate at
        //    lib/turnover/deposit-gate.ts subtracts active UserBonus rows
        //    of sourceType='cashback_campaign' from the withdrawable
        //    balance so the cashback cannot leave the platform before
        //    the turnover requirement is met.
        await tx.wallet.upsert({
          where: { userId },
          update: { balance: { increment: cashback } },
          create: { userId, balance: cashback, bonusBalance: 0, lockedBalance: 0, currency: 'BDT' },
        });

        // 3. UserBonus row carries the turnover lock. turnoverRequired
        //    can be 0 (no lock) when the operator sets campaign.turnoverX=0.
        //    The withdrawal gate aggregates by sourceType, so a 0-turnover
        //    UserBonus contributes nothing to the lock and is harmless.
        const grant = await tx.userBonus.create({
          data: {
            userId,
            bonusRuleId,
            amount: cashback,
            expiresAt,
            status: 'active',
            turnoverRequired,
            turnoverProgress: 0,
            sourceType: 'cashback_campaign',
            sourceId: created.id,
            note: `Cashback ${campaign.nameEn} . ${periodKey}`,
          },
        });

        // 4. Transaction history row so the player sees the credit in
        //    /dashboard/wallet's transaction list.
        const walletTx = await tx.transaction.create({
          data: {
            userId,
            type: 'bonus',
            status: 'completed',
            amount: cashback,
            reference: created.id,
            description: `Cashback . ${campaign.nameEn} . ${periodKey}`,
            meta: {
              cashbackCampaignId: campaign.id,
              cashbackPayoutId: created.id,
              periodKey,
              baseAmount: Number(base),
              source: campaign.source,
              scopeType: campaign.scopeType,
              scopeKeys,
              turnoverRequired: Number(turnoverRequired),
            } as Prisma.JsonObject,
          },
        });

        // 5. Player-facing notification. kind='cashback' is what the
        //    site-layout CashbackCelebration component watches for; it
        //    pops a centred congratulations modal on the next page load.
        const amountText = fmtBdt(cashback);
        const campaignName = campaign.nameBn ? `${campaign.nameEn} (${campaign.nameBn})` : campaign.nameEn;
        const notification = await tx.notification.create({
          data: {
            titleEn: `Congratulations! You have received ${amountText} BDT Cashback`,
            titleBn: `অভিনন্দন! আপনি ${amountText} BDT ক্যাশব্যাক পেয়েছেন`,
            bodyEn: `From "${campaign.nameEn}" for period ${periodKey}. The cashback is credited to your balance${campaignTurnoverX.gt(0) ? ` with a ${campaignTurnoverX}x turnover lock` : ''}.`,
            bodyBn: `"${campaignName}" থেকে ${periodKey} সময়কালের জন্য। ক্যাশব্যাক আপনার ব্যালেন্সে যোগ হয়েছে${campaignTurnoverX.gt(0) ? `, ${campaignTurnoverX}x টার্নওভার শর্তসহ` : ''}।`,
            linkUrl: '/dashboard/wallet',
            priority: 'high',
            status: 'sent',
            audience: 'selected',
            kind: 'cashback',
          },
        });
        await tx.notificationRecipient.create({
          data: {
            notificationId: notification.id,
            userId,
            deliveredAt: new Date(),
          },
        });

        // 6. Wire the payout back to its wallet tx + bonus grant for
        //    the admin run-result view.
        await tx.cashbackPayout.update({
          where: { id: created.id },
          data: { walletTxId: walletTx.id, bonusGrantId: grant.id },
        });

        await tx.activityLog.create({
          data: {
            actorId: input.actorId ?? null,
            actorRole: input.actorRole ?? 'admin',
            action: 'CASHBACK_GRANT',
            target: created.id,
            detail: `${campaign.nameEn} . ${periodKey} . user ${userId}`,
            meta: {
              campaignId: campaign.id,
              userId,
              periodKey,
              cashbackAmount: Number(cashback),
              baseAmount: Number(base),
              turnoverRequired: Number(turnoverRequired),
              source: campaign.source,
              scopeType: campaign.scopeType,
              scopeKeys,
            } as Prisma.JsonObject,
          },
        });

        return created;
      });

      paidUsers += 1;
      totalCashback = totalCashback.add(cashback);
      lines.push({
        userId,
        baseAmount: Number(base),
        cashbackAmount: Number(cashback),
        status: 'granted',
        payoutId: payout.id,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_duplicate' });
      } else {
        const message = err instanceof Error ? err.message : 'unknown';
        console.error('[cashback/engine] payout failed', err);
        lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'failed', error: message });
      }
    }
  }

  return {
    campaignId: campaign.id,
    periodKey,
    periodStart: window.start,
    periodEnd: window.end,
    eligibleUsers: userTotals.size,
    paidUsers,
    totalCashback: Number(totalCashback),
    lines,
    dryRun,
  };
}
