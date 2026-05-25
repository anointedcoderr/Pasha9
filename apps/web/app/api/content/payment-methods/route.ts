// Built by Anointed Coder.
//
// Public list of active payment methods, split into deposit + payout
// channels so the /deposit and /withdraw forms can render only the
// relevant ones with the right min/max hints.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

export async function GET() {
  const rows = await db.paymentMethod.findMany({
    where: { status: 'active' },
    orderBy: [{ position: 'asc' }, { name: 'asc' }],
  });

  const serialize = (m: typeof rows[number]) => ({
    id: m.id,
    name: m.name,
    type: m.type,
    number: m.number,
    instruction: m.instruction,
    payoutInstruction: m.payoutInstruction,
    minDeposit: m.minDeposit == null ? null : Number(m.minDeposit),
    maxDeposit: m.maxDeposit == null ? null : Number(m.maxDeposit),
    minWithdrawal: m.minWithdrawal == null ? null : Number(m.minWithdrawal),
    maxWithdrawal: m.maxWithdrawal == null ? null : Number(m.maxWithdrawal),
  });

  return jsonOk({
    deposit: rows.filter((m) => m.depositEnabled).map(serialize),
    payout: rows.filter((m) => m.payoutEnabled).map(serialize),
  });
}
