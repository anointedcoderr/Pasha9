// Built by Anointed Coder.
//
// M2J dimension breakdowns. Returns per-bucket totals for a single
// metric, grouped by a category column (deposit method, withdrawal
// method, bonus rule type, commission basis, etc). Drives the pie /
// stacked-bar visualisations on the admin reports page.

import { db } from '@/lib/db/client';

export type BreakdownKind =
  | 'deposit_by_method'
  | 'withdrawal_by_method'
  | 'bonus_by_type'
  | 'commission_by_level'
  | 'lotto_by_tier';

export interface BreakdownRow {
  key: string;
  count: number;
  value: number;
}

export async function getBreakdown(kind: BreakdownKind, from: Date, to: Date): Promise<{
  kind: BreakdownKind;
  from: string;
  to: string;
  rows: BreakdownRow[];
  total: { count: number; value: number };
}> {
  let raw: Array<{ key: string; count: bigint | number; value: string | number | null }>;
  if (kind === 'deposit_by_method') {
    raw = await db.$queryRawUnsafe(
      `SELECT "method" AS key, COUNT(*)::bigint AS count, COALESCE(SUM("amount"), 0) AS value
       FROM "Deposit" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2
       GROUP BY "method" ORDER BY value DESC`,
      from,
      to,
    );
  } else if (kind === 'withdrawal_by_method') {
    raw = await db.$queryRawUnsafe(
      `SELECT "method" AS key, COUNT(*)::bigint AS count, COALESCE(SUM("amount"), 0) AS value
       FROM "Withdrawal" WHERE "status" = 'approved' AND "createdAt" BETWEEN $1 AND $2
       GROUP BY "method" ORDER BY value DESC`,
      from,
      to,
    );
  } else if (kind === 'bonus_by_type') {
    raw = await db.$queryRawUnsafe(
      `SELECT br."type"::text AS key, COUNT(*)::bigint AS count, COALESCE(SUM(ub."amount"), 0) AS value
       FROM "UserBonus" ub
       JOIN "BonusRule" br ON br.id = ub."bonusRuleId"
       WHERE ub."claimedAt" BETWEEN $1 AND $2
       GROUP BY br."type" ORDER BY value DESC`,
      from,
      to,
    );
  } else if (kind === 'commission_by_level') {
    raw = await db.$queryRawUnsafe(
      `SELECT CONCAT('L', "level"::text) AS key, COUNT(*)::bigint AS count, COALESCE(SUM("amount"), 0) AS value
       FROM "AffiliateCommission" WHERE "createdAt" BETWEEN $1 AND $2
       GROUP BY "level" ORDER BY "level" ASC`,
      from,
      to,
    );
  } else if (kind === 'lotto_by_tier') {
    raw = await db.$queryRawUnsafe(
      `SELECT "prizeTier" AS key, COUNT(*)::bigint AS count, COALESCE(SUM("amount"), 0) AS value
       FROM "LotteryWinning" WHERE "createdAt" BETWEEN $1 AND $2
       GROUP BY "prizeTier" ORDER BY value DESC`,
      from,
      to,
    );
  } else {
    raw = [];
  }

  const rows: BreakdownRow[] = raw.map((r) => ({
    key: r.key ?? 'unknown',
    count: Number(r.count ?? 0),
    value: Math.round(Number(r.value ?? 0) * 100) / 100,
  }));
  const total = rows.reduce(
    (acc, r) => ({ count: acc.count + r.count, value: acc.value + r.value }),
    { count: 0, value: 0 },
  );
  total.value = Math.round(total.value * 100) / 100;
  return { kind, from: from.toISOString(), to: to.toISOString(), rows, total };
}
