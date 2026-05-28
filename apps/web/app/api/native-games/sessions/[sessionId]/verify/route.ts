// Built by Anointed Coder.
//
// Pasha Native Games provably-fair verification.
//
// GET  /api/native-games/sessions/[sessionId]/verify
//   Returns serverSeed + clientSeed + every round (with gameData and
//   nonce) so the player can re-derive every outcome themselves. Only
//   available once the session is COMPLETED or EXPIRED - while it is
//   ACTIVE the serverSeed must stay secret to prevent the player from
//   pre-computing the next roll.
//
// POST /api/native-games/sessions/[sessionId]/verify
//   Closes the session (status -> EXPIRED) so the verify GET will
//   return the serverSeed. The next bet must open a fresh session.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withAuth, recordActivity } from '@/lib/auth/guard';
import { requireActiveUser } from '@/lib/auth/rbac';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { expireSession, verifySession, NATIVE_ERRORS } from '@/lib/native-games/service';

const ERR_MAP: Record<string, { status: number; message: string }> = {
  [NATIVE_ERRORS.SESSION_NOT_FOUND]: { status: 404, message: 'Session not found.' },
  [NATIVE_ERRORS.SESSION_NOT_OWNED]: { status: 403, message: 'Session belongs to another user.' },
  [NATIVE_ERRORS.SESSION_NOT_COMPLETED]: { status: 400, message: 'Close the session before verifying.' },
};

function mapError(msg: string) {
  const known = ERR_MAP[msg];
  if (known) return jsonError(known.status, msg, known.message);
  console.error('[native-games] verify error', msg);
  return jsonError(500, 'SERVER_ERROR');
}

export async function GET(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    try {
      const verification = await verifySession({ userId: session.sub, sessionId: params.sessionId });
      return jsonOk(verification);
    } catch (err) {
      return mapError(err instanceof Error ? err.message : String(err));
    }
  });
}

export async function POST(_req: NextRequest, { params }: { params: { sessionId: string } }) {
  return withAuth(async () => {
    const session = await requireActiveUser();
    try {
      await expireSession(session.sub, params.sessionId);
      await recordActivity({
        actorId: session.sub,
        actorRole: session.role,
        action: 'NATIVE_SESSION_CLOSE',
        target: params.sessionId,
      });
      return jsonOk({ sessionId: params.sessionId, status: 'EXPIRED' });
    } catch (err) {
      return mapError(err instanceof Error ? err.message : String(err));
    }
  });
}
