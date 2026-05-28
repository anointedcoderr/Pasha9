// Built by Anointed Coder.
//
// Pasha Native Games session lifecycle.
//
// POST /api/native-games/[gameCode]/sessions
//   Body: { clientSeed?: string }
//   Creates a fresh provably-fair session for the signed-in user. Returns
//   serverSeedHash (never the seed). The same session is reused for many
//   bets - the nonce ticks per round.
//
// GET  /api/native-games/[gameCode]/sessions
//   Returns the player's most recent sessions for the game (active and
//   completed). Used by the play page to pre-populate the fairness panel.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { rateLimit } from '@/lib/auth/rate-limit';
import { isNativeGamesEnabled } from '@/lib/native-games/flag';
import { isSupportedGameCode, NATIVE_GAMES_RATE_MAX, NATIVE_GAMES_RATE_WINDOW_MS } from '@/lib/native-games/config';
import { createSession, listUserSessions } from '@/lib/native-games/service';

const schema = z.object({
  clientSeed: z.string().trim().min(1).max(128).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { gameCode: string } }) {
  return withAuth(async () => {
    if (!isSupportedGameCode(params.gameCode)) return jsonError(404, 'GAME_NOT_FOUND');
    if (!(await isNativeGamesEnabled())) return jsonError(503, 'NATIVE_GAMES_DISABLED');

    const session = await requireActiveUser();

    const limit = rateLimit(`native-session:${session.sub}:${params.gameCode}`, NATIVE_GAMES_RATE_MAX, NATIVE_GAMES_RATE_WINDOW_MS);
    if (!limit.ok) return jsonError(429, 'RATE_LIMITED');

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    try {
      const view = await createSession({
        userId: session.sub,
        gameCode: params.gameCode,
        clientSeed: parsed.data.clientSeed ?? null,
      });
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'NATIVE_SESSION_OPEN',
        target: view.id,
        meta: { gameCode: view.gameCode },
      });
      return jsonOk({ session: view }, 201);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg === 'GAME_NOT_FOUND' || msg === 'GAME_INACTIVE') {
        return jsonError(msg === 'GAME_INACTIVE' ? 503 : 404, msg);
      }
      console.error('[native-games] createSession failed', err);
      return jsonError(500, 'SERVER_ERROR');
    }
  });
}

export async function GET(_req: NextRequest, { params }: { params: { gameCode: string } }) {
  return withAuth(async () => {
    if (!isSupportedGameCode(params.gameCode)) return jsonError(404, 'GAME_NOT_FOUND');
    const session = await requireActiveUser();
    const sessions = await listUserSessions(session.sub, params.gameCode);
    return jsonOk({ sessions });
  });
}
