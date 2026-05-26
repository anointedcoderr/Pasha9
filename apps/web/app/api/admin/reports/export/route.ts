// Built by Anointed Coder.
//
// M2J CSV export. type=deposits|withdrawals|users|commissions|
// bonus_grants|recovery_attempts|timeseries
// + the usual from/to ISO datetime params. timeseries also accepts
// metric + granularity (forwarded to the engine).
//
// Returns text/csv with Content-Disposition: attachment so the
// browser triggers a download.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError } from '@/lib/auth/errors';
import { db } from '@/lib/db/client';
import { toCsv, csvResponse } from '@/lib/reports/csv';
import { getTimeseries, ALL_METRICS, type Metric, type Granularity } from '@/lib/reports/timeseries';

const ALLOWED = ['deposits', 'withdrawals', 'users', 'commissions', 'bonus_grants', 'recovery_attempts', 'timeseries'] as const;

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('activity.read');
    const url = req.nextUrl;
    const type = url.searchParams.get('type') ?? 'deposits';
    if (!(ALLOWED as readonly string[]).includes(type)) {
      return jsonError(400, 'INVALID_TYPE', `Allowed: ${ALLOWED.join(', ')}`);
    }
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');
    const to = toStr && !Number.isNaN(Date.parse(toStr)) ? new Date(toStr) : new Date();
    const from = fromStr && !Number.isNaN(Date.parse(fromStr)) ? new Date(fromStr) : new Date(to.getTime() - 30 * 86_400_000);
    const stamp = new Date().toISOString().slice(0, 10);

    try {
      if (type === 'deposits') {
        const rows = await db.deposit.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true, phone: true } } },
        });
        const out = rows.map((d) => ({
          id: d.id,
          createdAt: d.createdAt,
          userId: d.userId,
          username: d.user.username,
          phone: d.user.phone,
          amount: Number(d.amount),
          method: d.method,
          transactionId: d.transactionId,
          status: d.status,
          reviewerId: d.reviewerId ?? '',
          reviewedAt: d.reviewedAt ?? '',
          providerKey: d.providerKey ?? '',
          providerRef: d.providerRef ?? '',
        }));
        return csvResponse(`deposits_${stamp}.csv`, toCsv(out));
      }

      if (type === 'withdrawals') {
        const rows = await db.withdrawal.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { username: true, phone: true } } },
        });
        const out = rows.map((w) => ({
          id: w.id,
          createdAt: w.createdAt,
          userId: w.userId,
          username: w.user.username,
          phone: w.user.phone,
          amount: Number(w.amount),
          method: w.method,
          accountNumber: w.accountNumber,
          accountName: w.accountName,
          status: w.status,
          processingState: w.processingState ?? '',
          reviewerId: w.reviewerId ?? '',
          reviewedAt: w.reviewedAt ?? '',
          paidAt: w.paidAt ?? '',
          providerKey: w.providerKey ?? '',
          providerRef: w.providerRef ?? '',
        }));
        return csvResponse(`withdrawals_${stamp}.csv`, toCsv(out));
      }

      if (type === 'users') {
        const rows = await db.user.findMany({
          where: { createdAt: { gte: from, lte: to }, role: { key: 'user' } },
          orderBy: { createdAt: 'desc' },
          include: { wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true } } },
        });
        const out = rows.map((u) => ({
          id: u.id,
          createdAt: u.createdAt,
          username: u.username,
          phone: u.phone,
          email: u.email ?? '',
          country: u.country,
          language: u.language,
          status: u.status,
          referralCode: u.referralCode,
          referredById: u.referredById ?? '',
          isAffiliate: u.isAffiliate,
          lastLoginAt: u.lastLoginAt ?? '',
          balance: u.wallet ? Number(u.wallet.balance) : 0,
          bonusBalance: u.wallet ? Number(u.wallet.bonusBalance) : 0,
          lockedBalance: u.wallet ? Number(u.wallet.lockedBalance) : 0,
          lottoBalance: u.wallet ? Number(u.wallet.lottoBalance) : 0,
        }));
        return csvResponse(`users_${stamp}.csv`, toCsv(out));
      }

      if (type === 'commissions') {
        const rows = await db.affiliateCommission.findMany({
          where: { createdAt: { gte: from, lte: to } },
          orderBy: { createdAt: 'desc' },
        });
        const out = rows.map((c) => ({
          id: c.id,
          createdAt: c.createdAt,
          affiliateId: c.affiliateId,
          sourceUserId: c.sourceUserId,
          level: c.level,
          amount: Number(c.amount),
          basis: c.basis,
          status: c.status,
          ratePct: c.ratePct ? Number(c.ratePct) : '',
          depositId: c.depositId ?? '',
          tierId: c.tierId ?? '',
          payoutId: c.payoutId ?? '',
        }));
        return csvResponse(`commissions_${stamp}.csv`, toCsv(out));
      }

      if (type === 'bonus_grants') {
        const rows = await db.userBonus.findMany({
          where: { claimedAt: { gte: from, lte: to } },
          orderBy: { claimedAt: 'desc' },
          include: { bonusRule: { select: { name: true, type: true } } },
        });
        const out = rows.map((g) => ({
          id: g.id,
          claimedAt: g.claimedAt,
          userId: g.userId,
          ruleName: g.bonusRule.name,
          ruleType: g.bonusRule.type,
          amount: Number(g.amount),
          turnoverRequired: Number(g.turnoverRequired),
          turnoverProgress: Number(g.turnoverProgress),
          status: g.status,
          sourceType: g.sourceType ?? '',
          sourceId: g.sourceId ?? '',
          releasedAt: g.releasedAt ?? '',
          expiresAt: g.expiresAt ?? '',
        }));
        return csvResponse(`bonus_grants_${stamp}.csv`, toCsv(out));
      }

      if (type === 'recovery_attempts') {
        const rows = await db.recoveryContactLog.findMany({
          where: { attemptedAt: { gte: from, lte: to } },
          orderBy: { attemptedAt: 'desc' },
        });
        const out = rows.map((r) => ({
          id: r.id,
          attemptedAt: r.attemptedAt,
          taskId: r.taskId,
          staffId: r.staffId,
          channel: r.channel,
          outcome: r.outcome,
          notes: r.notes ?? '',
        }));
        return csvResponse(`recovery_attempts_${stamp}.csv`, toCsv(out));
      }

      // timeseries: returns the bucketed values + sub-totals
      if (type === 'timeseries') {
        const metric = (url.searchParams.get('metric') ?? 'deposits') as Metric;
        if (!ALL_METRICS.includes(metric)) {
          return jsonError(400, 'INVALID_METRIC');
        }
        const granularity = (url.searchParams.get('granularity') ?? 'day') as Granularity;
        if (!['day', 'week', 'month'].includes(granularity)) {
          return jsonError(400, 'INVALID_GRANULARITY');
        }
        const result = await getTimeseries({ metric, granularity, from, to });
        const out = result.buckets.map((b) => ({
          bucket: b.bucket,
          value: b.value,
          count: b.count,
        }));
        return csvResponse(`timeseries_${metric}_${granularity}_${stamp}.csv`, toCsv(out));
      }

      return jsonError(400, 'INVALID_TYPE');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[reports-export] failed', err);
      return jsonError(500, 'EXPORT_FAILED', msg);
    }
  });
}
