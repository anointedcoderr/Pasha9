// Built by Anointed Coder.
//
// M2J time-series engine. One entry point: getTimeseries(metric,
// granularity, from, to). Returns an array of buckets, each:
//   { bucket: ISO timestamp at the start of the period,
//     value:  numeric metric value,
//     count:  number of contributing rows }
//
// Postgres date_trunc handles day / week / month bucketing in a
// single query, so the SQL stays cheap even on multi-year ranges.
// Empty buckets are zero-filled in JS so the chart renders a flat
// line instead of skipping days.

import { db } from '@/lib/db/client';

export type Metric =
  | 'deposits'           // approved deposit amount per bucket
  | 'deposits_count'     // approved deposit count
  | 'withdrawals'        // approved withdrawal amount
  | 'withdrawals_count'  // approved withdrawal count
  | 'signups'            // User.createdAt count
  | 'active_users'       // unique users with lastLoginAt in bucket
  | 'bonus_payout'       // UserBonus.amount where status=completed
  | 'commission_paid'    // AffiliateCommission.amount where status=paid
  | 'lotto_payout'       // LotteryWinning.amount where status=credited
  | 'net_cash'           // approved deposits - approved withdrawals
  | 'operating_result';  // net_cash - bonus_payout - commission_paid - lotto_payout

export type Granularity = 'day' | 'week' | 'month';

export interface TsBucket {
  bucket: string;        // ISO timestamp at the start of the period
  value: number;
  count: number;
}

// Postgres `date_trunc` is the simplest cross-version way to bucket.
// We pass the literal because Prisma's tagged template would quote
// it as a parameter and Postgres rejects that for the unit.
function truncSql(granularity: Granularity): string {
  if (granularity === 'week') return `date_trunc('week', t.ts)`;
  if (granularity === 'month') return `date_trunc('month', t.ts)`;
  return `date_trunc('day', t.ts)`;
}

interface RawRow { bucket: Date; value: string | number | null; count: bigint | number }

async function runMetricQuery(metric: Metric, granularity: Granularity, from: Date, to: Date): Promise<TsBucket[]> {
  const trunc = truncSql(granularity);

  // Each metric is a small SELECT projecting (ts, value, weight=1).
  // Then we wrap with date_trunc + sum.
  const baseQuery: string = (() => {
    if (metric === 'deposits') {
      return `SELECT "createdAt" AS ts, "amount" AS amt FROM "Deposit" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'deposits_count') {
      return `SELECT "createdAt" AS ts, 1::numeric AS amt FROM "Deposit" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'withdrawals') {
      return `SELECT "createdAt" AS ts, "amount" AS amt FROM "Withdrawal" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'withdrawals_count') {
      return `SELECT "createdAt" AS ts, 1::numeric AS amt FROM "Withdrawal" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'signups') {
      return `SELECT u."createdAt" AS ts, 1::numeric AS amt FROM "User" u JOIN "Role" r ON r.id = u."roleId" WHERE r.key = 'user' AND u."createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'active_users') {
      // One row per user per bucket. Distinct count handled by grouping
      // over distinct (userId, bucket) before the outer aggregate.
      return `SELECT DISTINCT u.id AS uid, ${trunc.replace('t.ts', 'u."lastLoginAt"')} AS bucket FROM "User" u WHERE u."lastLoginAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'bonus_payout') {
      return `SELECT "claimedAt" AS ts, "amount" AS amt FROM "UserBonus" WHERE "status" = 'completed' AND "claimedAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'commission_paid') {
      return `SELECT "createdAt" AS ts, "amount" AS amt FROM "AffiliateCommission" WHERE "status" = 'paid' AND "createdAt" BETWEEN $1 AND $2`;
    }
    if (metric === 'lotto_payout') {
      return `SELECT "createdAt" AS ts, "amount" AS amt FROM "LotteryWinning" WHERE "status" = 'credited' AND "createdAt" BETWEEN $1 AND $2`;
    }
    // net_cash + operating_result are composed in JS from sub-metrics.
    return '';
  })();

  if (metric === 'active_users') {
    // Special-case: count distinct users per bucket.
    const rows = await db.$queryRawUnsafe<Array<{ bucket: Date; count: bigint }>>(
      `SELECT bucket, COUNT(*)::bigint AS count
       FROM (${baseQuery}) sub
       GROUP BY bucket
       ORDER BY bucket ASC`,
      from,
      to,
    );
    return rows.map((r) => ({
      bucket: r.bucket.toISOString(),
      value: Number(r.count),
      count: Number(r.count),
    }));
  }

  if (metric === 'net_cash' || metric === 'operating_result') {
    const deposits = await runMetricQuery('deposits', granularity, from, to);
    const withdrawals = await runMetricQuery('withdrawals', granularity, from, to);
    let bonus: TsBucket[] = [];
    let commission: TsBucket[] = [];
    let lotto: TsBucket[] = [];
    if (metric === 'operating_result') {
      [bonus, commission, lotto] = await Promise.all([
        runMetricQuery('bonus_payout', granularity, from, to),
        runMetricQuery('commission_paid', granularity, from, to),
        runMetricQuery('lotto_payout', granularity, from, to),
      ]);
    }
    const buckets = new Map<string, number>();
    for (const d of deposits) buckets.set(d.bucket, (buckets.get(d.bucket) ?? 0) + d.value);
    for (const w of withdrawals) buckets.set(w.bucket, (buckets.get(w.bucket) ?? 0) - w.value);
    for (const b of bonus) buckets.set(b.bucket, (buckets.get(b.bucket) ?? 0) - b.value);
    for (const c of commission) buckets.set(c.bucket, (buckets.get(c.bucket) ?? 0) - c.value);
    for (const l of lotto) buckets.set(l.bucket, (buckets.get(l.bucket) ?? 0) - l.value);
    return Array.from(buckets.entries())
      .map(([bucket, value]) => ({ bucket, value: round2(value), count: 0 }))
      .sort((a, b) => a.bucket.localeCompare(b.bucket));
  }

  const rows = await db.$queryRawUnsafe<RawRow[]>(
    `SELECT ${trunc} AS bucket,
            COALESCE(SUM(t.amt), 0) AS value,
            COUNT(*)::bigint AS count
     FROM (${baseQuery}) t
     GROUP BY bucket
     ORDER BY bucket ASC`,
    from,
    to,
  );

  return rows.map((r) => ({
    bucket: r.bucket.toISOString(),
    value: round2(Number(r.value)),
    count: Number(r.count ?? 0),
  }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function bucketStart(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  if (granularity === 'day') {
    d.setUTCHours(0, 0, 0, 0);
  } else if (granularity === 'week') {
    // Monday-start week to align with Postgres date_trunc('week', ...)
    const day = d.getUTCDay();
    const back = (day + 6) % 7;
    d.setUTCDate(d.getUTCDate() - back);
    d.setUTCHours(0, 0, 0, 0);
  } else {
    d.setUTCDate(1);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d;
}

function nextBucket(date: Date, granularity: Granularity): Date {
  const d = new Date(date);
  if (granularity === 'day') d.setUTCDate(d.getUTCDate() + 1);
  else if (granularity === 'week') d.setUTCDate(d.getUTCDate() + 7);
  else d.setUTCMonth(d.getUTCMonth() + 1);
  return d;
}

/** Pads missing buckets with zeros so the chart renders a flat line. */
function zeroFill(buckets: TsBucket[], from: Date, to: Date, granularity: Granularity): TsBucket[] {
  const map = new Map(buckets.map((b) => [b.bucket, b]));
  const out: TsBucket[] = [];
  let cursor = bucketStart(from, granularity);
  const end = bucketStart(to, granularity);
  // Safety cap: avoid producing absurd row counts for huge ranges.
  let safety = 1000;
  while (cursor <= end && safety > 0) {
    const key = cursor.toISOString();
    out.push(map.get(key) ?? { bucket: key, value: 0, count: 0 });
    cursor = nextBucket(cursor, granularity);
    safety -= 1;
  }
  return out;
}

export interface TimeseriesResult {
  metric: Metric;
  granularity: Granularity;
  from: string;
  to: string;
  buckets: TsBucket[];
  totals: { value: number; count: number };
}

export async function getTimeseries(opts: {
  metric: Metric;
  granularity?: Granularity;
  from?: Date;
  to?: Date;
}): Promise<TimeseriesResult> {
  const granularity: Granularity = opts.granularity ?? 'day';
  const to = opts.to ?? new Date();
  const from = opts.from ?? new Date(to.getTime() - 30 * 86_400_000);
  const raw = await runMetricQuery(opts.metric, granularity, from, to);
  const buckets = zeroFill(raw, from, to, granularity);
  const totals = buckets.reduce(
    (acc, b) => ({ value: acc.value + b.value, count: acc.count + b.count }),
    { value: 0, count: 0 },
  );
  totals.value = round2(totals.value);
  return {
    metric: opts.metric,
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    buckets,
    totals,
  };
}

export const ALL_METRICS: Metric[] = [
  'deposits',
  'deposits_count',
  'withdrawals',
  'withdrawals_count',
  'signups',
  'active_users',
  'bonus_payout',
  'commission_paid',
  'lotto_payout',
  'net_cash',
  'operating_result',
];

export const METRIC_LABELS: Record<Metric, string> = {
  deposits: 'Approved deposits (BDT)',
  deposits_count: 'Approved deposits (count)',
  withdrawals: 'Approved withdrawals (BDT)',
  withdrawals_count: 'Approved withdrawals (count)',
  signups: 'New signups',
  active_users: 'Active users (distinct logins)',
  bonus_payout: 'Bonus released (BDT)',
  commission_paid: 'Affiliate commission paid (BDT)',
  lotto_payout: 'Lotto winnings credited (BDT)',
  net_cash: 'Net cash (deposits - withdrawals)',
  operating_result: 'Operating result (net cash - bonus - commission - lotto)',
};
