// Built by Anointed Coder.
//
// Public read of active promotional bonus rules. Used by the public
// /promotions page and the rule explainer on /dashboard/bonus.
// Returns only what is safe to expose - no actor counts, no grant
// totals. Includes a small `effective` summary that humanises
// percentage + flat + cap into a single sentence.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

function describe(r: {
  amount: unknown;
  percentage: unknown;
  maxBonus: unknown;
  minDeposit: unknown;
  turnoverX: unknown;
  validityDays: number;
}): string {
  const pct = Number(r.percentage);
  const flat = Number(r.amount);
  const cap = Number(r.maxBonus);
  const min = Number(r.minDeposit);
  const tx = Number(r.turnoverX);

  const parts: string[] = [];
  if (pct > 0) parts.push(`${pct}% bonus`);
  if (flat > 0) parts.push(`+ ${flat.toLocaleString()} BDT flat`);
  if (cap > 0) parts.push(`(max ${cap.toLocaleString()})`);
  let body = parts.length > 0 ? parts.join(' ') : 'No payout configured';
  if (min > 0) body += ` on deposits from ${min.toLocaleString()} BDT`;
  if (tx > 0) body += `. Wagering ${tx}x before release`;
  if (r.validityDays > 0) body += `. Expires in ${r.validityDays} days`;
  return body;
}

export async function GET() {
  const rows = await db.bonusRule.findMany({
    where: { status: 'active' },
    orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
  });
  const now = new Date();
  const live = rows.filter((r) => {
    if (r.startsAt && r.startsAt > now) return false;
    if (r.endsAt && r.endsAt < now) return false;
    return true;
  });
  return jsonOk({
    promotions: live.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      code: r.code,
      percentage: Number(r.percentage),
      amount: Number(r.amount),
      minDeposit: Number(r.minDeposit),
      maxBonus: Number(r.maxBonus),
      turnoverX: Number(r.turnoverX),
      validityDays: r.validityDays,
      description: r.description,
      effective: describe(r),
      startsAt: r.startsAt,
      endsAt: r.endsAt,
    })),
  });
}
