// Built by Anointed Coder.
//
// Cashback engine. For a given CashbackCampaign and period window,
// computes the eligible base (net loss or total wager) per user from
// the Transaction ledger, applies the configured percentage and cap,
// and credits each eligible player in a single Prisma transaction
// per payout. CashbackPayout.idempotencyKey blocks a double-payout
// for the same (campaign, user, period) combination.
//
// Net loss formula:    sum(bet) - sum(win)    (positive means the
//                      player lost money in this window; zero or
//                      negative means no cashback owed)
// Wager amount formula: sum(bet)               (always >= 0)
//
// Bet/win amounts in the Transaction ledger are positive magnitudes
// regardless of direction; we never trust signs.

import { Prisma, TxType } from '@prisma/client';
import { db } from '@/lib/db/client';
import { grantBonusInTx } from '@/lib/bonuses/engine';

export interface CashbackRunInput {
  campaignId: string;
  periodStart?: Date;
  periodEnd?: Date;
  actorId?: string | null;
  actorRole?: string | null;
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
  const end = new Date(now);
  const start = new Date(now);
  if (cadence === 'daily') start.setUTCDate(end.getUTCDate() - 1);
  else if (cadence === 'monthly') start.setUTCMonth(end.getUTCMonth() - 1);
  else start.setUTCDate(end.getUTCDate() - 7);
  return { start, end };
}

export async function runCashbackCampaign(input: CashbackRunInput): Promise<CashbackRunResult> {
  const campaign = await db.cashbackCampaign.findUnique({
    where: { id: input.campaignId },
    include: { bonusRule: true },
  });
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND');
  if (!campaign.isActive) throw new Error('CAMPAIGN_INACTIVE');

  const now = new Date();
  const window = (() => {
    if (input.periodStart && input.periodEnd) return { start: input.periodStart, end: input.periodEnd };
    return defaultPeriodWindow(campaign.cadence, now);
  })();
  const periodKey = periodKeyFor(campaign.cadence, window.end);

  // Honour campaign window when set.
  if (campaign.startsAt && window.end < campaign.startsAt) {
    return { campaignId: campaign.id, periodKey, periodStart: window.start, periodEnd: window.end, eligibleUsers: 0, paidUsers: 0, totalCashback: 0, lines: [] };
  }
  if (campaign.endsAt && window.start > campaign.endsAt) {
    return { campaignId: campaign.id, periodKey, periodStart: window.start, periodEnd: window.end, eligibleUsers: 0, paidUsers: 0, totalCashback: 0, lines: [] };
  }

  // Aggregate per-user bet and win amounts over the window.
  const grouped = await db.transaction.groupBy({
    by: ['userId', 'type'],
    where: {
      status: 'completed',
      createdAt: { gte: window.start, lte: window.end },
      type: { in: [TxType.bet, TxType.win] },
    },
    _sum: { amount: true },
  });

  const userTotals = new Map<string, { bet: Prisma.Decimal; win: Prisma.Decimal }>();
  for (const row of grouped) {
    const cur = userTotals.get(row.userId) ?? { bet: dec(0), win: dec(0) };
    if (row.type === 'bet') cur.bet = cur.bet.add(dec(row._sum.amount ?? 0));
    if (row.type === 'win') cur.win = cur.win.add(dec(row._sum.amount ?? 0));
    userTotals.set(row.userId, cur);
  }

  const percentage = dec(campaign.percentage);
  const maxCashback = dec(campaign.maxCashback);
  const lines: CashbackPayoutLine[] = [];
  let paidUsers = 0;
  let totalCashback = dec(0);

  for (const [userId, totals] of userTotals.entries()) {
    const base = campaign.source === 'wager_amount' ? totals.bet : totals.bet.sub(totals.win);
    if (base.lte(0)) {
      lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_zero' });
      continue;
    }
    let cashback = base.mul(percentage).div(100);
    if (maxCashback.gt(0) && cashback.gt(maxCashback)) cashback = maxCashback;
    if (cashback.lte(0)) {
      lines.push({ userId, baseAmount: Number(base), cashbackAmount: 0, status: 'skipped_zero' });
      continue;
    }

    const idempotencyKey = `${campaign.id}:${userId}:${periodKey}`;
    try {
      const payout = await db.$transaction(async (tx) => {
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

        let walletTxId: string | null = null;
        let bonusGrantId: string | null = null;

        if (Number(campaign.turnoverX) > 0 && campaign.bonusRule) {
          const grant = await grantBonusInTx(tx, {
            userId,
            rule: campaign.bonusRule,
            amount: cashback,
            sourceType: 'cashback_campaign',
            sourceId: created.id,
            note: `Cashback ${campaign.nameEn} . ${periodKey}`,
          });
          if (grant) bonusGrantId = grant.grantId;
        } else {
          // Direct bonus balance credit.
          await tx.wallet.update({
            where: { userId },
            data: { bonusBalance: { increment: cashback } },
          });
          const walletTx = await tx.transaction.create({
            data: {
              userId,
              type: 'bonus',
              status: 'completed',
              amount: cashback,
              reference: created.id,
              description: `Cashback ${campaign.nameEn} . ${periodKey}`,
              meta: {
                cashbackCampaignId: campaign.id,
                cashbackPayoutId: created.id,
                periodKey,
                baseAmount: Number(base),
                source: campaign.source,
              } as Prisma.JsonObject,
            },
          });
          walletTxId = walletTx.id;
        }

        await tx.cashbackPayout.update({
          where: { id: created.id },
          data: { walletTxId, bonusGrantId },
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
              source: campaign.source,
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
  };
}
