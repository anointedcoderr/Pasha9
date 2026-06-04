// Built by Anointed Coder.
//
// POST /api/admin/spin-segments/seed
//
// Idempotently inserts a default 8-segment spin wheel when the
// SpinSegment table has zero rows. Lets a fresh deployment switch the
// public Spin tab from "not configured" to a playable wheel in one
// click from /admin/spin-segments. Re-running with any existing row
// returns kept=count without writing anything.

export const dynamic = 'force-dynamic';

import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

type PayoutType = 'coins' | 'bonus' | 'freebet' | 'freespin' | 'nothing';

interface DefaultSegment {
  label: string;
  color: string;
  weight: number;
  payoutType: PayoutType;
  payoutAmount: number;
  turnoverX: number;
  position: number;
}

// Eight wedges. Common big-prize, sane consolation, one bonus tier
// with a 3x turnover so the bonus engine path is exercised.
export const DEFAULT_SPIN_SEGMENTS: DefaultSegment[] = [
  { label: '25',  color: '#3B82F6', weight: 28, payoutType: 'coins',   payoutAmount: 25,  turnoverX: 0, position: 0 },
  { label: '50',  color: '#22C55E', weight: 22, payoutType: 'coins',   payoutAmount: 50,  turnoverX: 0, position: 1 },
  { label: '100', color: '#F59E0B', weight: 18, payoutType: 'coins',   payoutAmount: 100, turnoverX: 0, position: 2 },
  { label: 'X2',  color: '#EF4444', weight: 12, payoutType: 'coins',   payoutAmount: 200, turnoverX: 0, position: 3 },
  { label: '500', color: '#8B5CF6', weight: 8,  payoutType: 'coins',   payoutAmount: 500, turnoverX: 0, position: 4 },
  { label: 'X3',  color: '#F97316', weight: 6,  payoutType: 'coins',   payoutAmount: 300, turnoverX: 0, position: 5 },
  { label: 'BONUS 200', color: '#EC4899', weight: 4, payoutType: 'bonus', payoutAmount: 200, turnoverX: 3, position: 6 },
  { label: 'TRY AGAIN', color: '#64748B', weight: 2, payoutType: 'nothing', payoutAmount: 0,  turnoverX: 0, position: 7 },
];

export async function POST() {
  return withAuth(async () => {
    const session = await ensurePermission('rewards.write');
    const existing = await db.spinSegment.count();
    if (existing > 0) {
      return jsonOk({ ok: true, created: 0, kept: existing, alreadySeeded: true });
    }

    await db.$transaction(
      DEFAULT_SPIN_SEGMENTS.map((s) =>
        db.spinSegment.create({
          data: {
            label: s.label,
            color: s.color,
            weight: s.weight,
            payoutType: s.payoutType,
            payoutAmount: s.payoutAmount,
            turnoverX: s.turnoverX,
            position: s.position,
            isActive: true,
          },
        }),
      ),
    );

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'SPIN_SEGMENTS_SEED',
      target: 'spin_segments',
      meta: { count: DEFAULT_SPIN_SEGMENTS.length },
    });

    return jsonOk({ ok: true, created: DEFAULT_SPIN_SEGMENTS.length, kept: 0, alreadySeeded: false });
  });
}
