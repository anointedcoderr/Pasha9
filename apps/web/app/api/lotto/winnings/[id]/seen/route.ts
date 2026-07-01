// Built by Anointed Coder.
//
// POST /api/lotto/winnings/[id]/seen
//
// Marks a single LotteryWinning row as having had its celebration
// popup acknowledged by the player. This is purely a UI suppression
// flag: it never touches the wallet, the Transaction ledger, or the
// row's status, so the one-time credit path is completely untouched.
//
// Idempotency: the updateMany is guarded by celebrationSeenAt=null,
// so a second call after the flag is already set is a no-op. The
// where clause also pins userId, so a player can only acknowledge
// their own wins. Rate-limited at 30 calls per 5 min per user.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();

    const limit = rateLimit(`lotto-seen:${session.sub}`, 30, 5 * 60_000);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    await db.lotteryWinning.updateMany({
      where: { id: params.id, userId: session.sub, celebrationSeenAt: null },
      data: { celebrationSeenAt: new Date() },
    });

    return jsonOk({ ok: true });
  });
}
