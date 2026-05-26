// Built by Anointed Coder.
//
// M2J signup-cohort analyzer. For each weekly (or daily / monthly)
// cohort of new players we report:
//   - cohort size (signups in that bucket)
//   - first-deposit conversion (% of cohort that made at least one
//     approved deposit ever)
//   - total deposits ever (lifetime BDT)
//   - average revenue per user (LTV proxy)
//   - retained-7d / retained-30d (% with a deposit OR login within
//     the window after their signup date)
//
// All computed with two SQL queries:
//   - cohort buckets + sizes
//   - per-cohort deposit aggregates joined to signup bucket
// Then retention joins lastLoginAt against signup bucket.
//
// Permission gate (activity.read) is enforced at the API layer.

import { db } from '@/lib/db/client';

export type CohortGranularity = 'day' | 'week' | 'month';

function truncSql(g: CohortGranularity, col: string): string {
  if (g === 'month') return `date_trunc('month', ${col})`;
  if (g === 'day') return `date_trunc('day', ${col})`;
  return `date_trunc('week', ${col})`;
}

export interface CohortRow {
  cohort: string;            // ISO bucket start
  size: number;              // signups in the cohort
  depositors: number;        // distinct users who made at least one approved deposit
  conversionPct: number;     // depositors / size * 100
  totalDeposits: number;     // BDT, lifetime
  arpu: number;              // totalDeposits / size
  retained7d: number;        // users with lastLoginAt within 7 days of signup
  retained30d: number;       // users with lastLoginAt within 30 days of signup
}

export interface CohortsResult {
  granularity: CohortGranularity;
  from: string;
  to: string;
  rows: CohortRow[];
}

export async function getCohorts(opts: {
  granularity?: CohortGranularity;
  from?: Date;
  to?: Date;
}): Promise<CohortsResult> {
  const granularity = opts.granularity ?? 'week';
  const to = opts.to ?? new Date();
  const from = opts.from ?? new Date(to.getTime() - 90 * 86_400_000);

  const trunc = truncSql(granularity, 'u."createdAt"');

  // 1. Cohort sizes.
  const sizeRows = await db.$queryRawUnsafe<Array<{ cohort: Date; size: bigint }>>(
    `SELECT ${trunc} AS cohort, COUNT(*)::bigint AS size
     FROM "User" u
     JOIN "Role" r ON r.id = u."roleId"
     WHERE r.key = 'user' AND u."createdAt" BETWEEN $1 AND $2
     GROUP BY cohort
     ORDER BY cohort ASC`,
    from,
    to,
  );

  // 2. Per-cohort deposit aggregates (lifetime, not bucketed).
  const depAggRows = await db.$queryRawUnsafe<Array<{ cohort: Date; depositors: bigint; total: string | number }>>(
    `SELECT ${trunc} AS cohort,
            COUNT(DISTINCT u.id)::bigint AS depositors,
            COALESCE(SUM(d.amount), 0) AS total
     FROM "User" u
     JOIN "Role" r ON r.id = u."roleId"
     LEFT JOIN "Deposit" d ON d."userId" = u.id AND d."status" = 'approved'
     WHERE r.key = 'user' AND u."createdAt" BETWEEN $1 AND $2
       AND d.id IS NOT NULL
     GROUP BY cohort
     ORDER BY cohort ASC`,
    from,
    to,
  );

  // 3. Retention: 7d, 30d windows after signup. Counts users whose
  // lastLoginAt is BOTH >= signup AND <= signup + N days.
  const ret7Rows = await db.$queryRawUnsafe<Array<{ cohort: Date; retained: bigint }>>(
    `SELECT ${trunc} AS cohort, COUNT(*)::bigint AS retained
     FROM "User" u
     JOIN "Role" r ON r.id = u."roleId"
     WHERE r.key = 'user'
       AND u."createdAt" BETWEEN $1 AND $2
       AND u."lastLoginAt" IS NOT NULL
       AND u."lastLoginAt" >= u."createdAt"
       AND u."lastLoginAt" <= u."createdAt" + interval '7 days'
     GROUP BY cohort
     ORDER BY cohort ASC`,
    from,
    to,
  );
  const ret30Rows = await db.$queryRawUnsafe<Array<{ cohort: Date; retained: bigint }>>(
    `SELECT ${trunc} AS cohort, COUNT(*)::bigint AS retained
     FROM "User" u
     JOIN "Role" r ON r.id = u."roleId"
     WHERE r.key = 'user'
       AND u."createdAt" BETWEEN $1 AND $2
       AND u."lastLoginAt" IS NOT NULL
       AND u."lastLoginAt" >= u."createdAt"
       AND u."lastLoginAt" <= u."createdAt" + interval '30 days'
     GROUP BY cohort
     ORDER BY cohort ASC`,
    from,
    to,
  );

  const depMap = new Map(depAggRows.map((r) => [r.cohort.toISOString(), r]));
  const ret7Map = new Map(ret7Rows.map((r) => [r.cohort.toISOString(), Number(r.retained)]));
  const ret30Map = new Map(ret30Rows.map((r) => [r.cohort.toISOString(), Number(r.retained)]));

  const rows: CohortRow[] = sizeRows.map((s) => {
    const key = s.cohort.toISOString();
    const dep = depMap.get(key);
    const size = Number(s.size);
    const depositors = dep ? Number(dep.depositors) : 0;
    const totalDeposits = dep ? Number(dep.total) : 0;
    return {
      cohort: key,
      size,
      depositors,
      conversionPct: size > 0 ? Number(((depositors / size) * 100).toFixed(2)) : 0,
      totalDeposits: Math.round(totalDeposits * 100) / 100,
      arpu: size > 0 ? Math.round((totalDeposits / size) * 100) / 100 : 0,
      retained7d: ret7Map.get(key) ?? 0,
      retained30d: ret30Map.get(key) ?? 0,
    };
  });

  return {
    granularity,
    from: from.toISOString(),
    to: to.toISOString(),
    rows,
  };
}
