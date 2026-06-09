// Built by Anointed Coder.
//
// POST /api/admin/lotto/[id]/generate-result
//
// Server-side randomiser that picks 23 winning numbers per the
// client spec (1 First, 1 Second, 1 Third, 10 Special, 10
// Consolation). Independent random selection per tier - no
// derived values - so the result feels like a real draw.
//
// This endpoint does NOT settle the draw. It just returns the
// generated numbers so the admin can review them in the settle
// modal, edit any value, and then call /settle when satisfied.
// The actual settlement endpoint stays the canonical place for
// money math.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { randomInt } from 'node:crypto';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';

function pad4(n: number): string {
  return n.toString().padStart(4, '0');
}

// Pick an n-digit number from a uniformly random integer 0 - 10^n - 1
// using crypto.randomInt so it is not affected by Math.random's
// 32-bit bias.
function pickDigits(digits: number): string {
  const max = 10 ** digits;
  return randomInt(0, max).toString().padStart(digits, '0');
}

// Pick k distinct numbers in the same digit space. We retry a
// few times to avoid collisions; for k <= 20 collisions are very
// rare so this almost always finishes in one pass.
function pickDistinct(digits: number, count: number, exclude: Set<string>): string[] {
  const picked: string[] = [];
  const taken = new Set<string>(exclude);
  let attempts = 0;
  while (picked.length < count && attempts < count * 50) {
    const candidate = pickDigits(digits);
    if (!taken.has(candidate)) {
      taken.add(candidate);
      picked.push(candidate);
    }
    attempts += 1;
  }
  return picked;
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('lotto.write');

    const draw = await db.lottoDraw.findUnique({ where: { id: params.id } });
    if (!draw) return jsonError(404, 'DRAW_NOT_FOUND');

    const digits = draw.digitsCount ?? 4;

    // 1st prize - the single canonical winning number that the
    // settlement engine compares every ticket against.
    const winningNumber = pickDigits(digits);
    // 2nd and 3rd - independent randoms, must not collide with 1st.
    const used = new Set<string>([winningNumber]);
    const [secondPick] = pickDistinct(digits, 1, used);
    used.add(secondPick);
    const [thirdPick] = pickDistinct(digits, 1, used);
    used.add(thirdPick);

    // 10 Special + 10 Consolation - independent per tier, no
    // duplicates inside or across tiers.
    const specials = pickDistinct(digits, 10, used);
    for (const s of specials) used.add(s);
    const consolations = pickDistinct(digits, 10, used);

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: 'LOTTO_GENERATE_RESULT',
      target: draw.id,
      meta: {
        winningNumber,
        secondPick,
        thirdPick,
        specialsCount: specials.length,
        consolationsCount: consolations.length,
      },
    });

    return jsonOk({
      drawId: draw.id,
      winningNumber,
      extraNumbers: {
        second: secondPick,
        third: thirdPick,
        specials,
        consolations,
      },
    });
  });
}
