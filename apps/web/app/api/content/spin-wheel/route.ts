// Built by Anointed Coder.
//
// Public spin wheel description. Returns the active segment list +
// admin-configured rules so the public /rewards page can render a
// fair-looking wheel with the operator's segment labels and colours.

export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';
import { loadSpinConfig } from '@/lib/rewards/config';

export async function GET() {
  const [segments, config] = await Promise.all([
    db.spinSegment.findMany({ where: { isActive: true }, orderBy: { position: 'asc' } }),
    loadSpinConfig(),
  ]);
  return jsonOk({
    config,
    segments: segments.map((s) => ({
      id: s.id,
      label: s.label,
      color: s.color,
      position: s.position,
      // payoutType and amount are visible so the public can read what
      // each wedge represents; the weight is intentionally NOT
      // exposed.
      payoutType: s.payoutType,
      payoutAmount: s.payoutAmount,
      turnoverX: Number(s.turnoverX),
    })),
  });
}
