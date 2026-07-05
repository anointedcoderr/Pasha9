// Built by Anointed Coder.
//
// Pasha WinGo live state for one mode. Public (no auth) so the play page
// renders the countdown and history strip before the player signs in.
//
// GET /api/games/wingo/state?mode=wingo_30s
//
// Response (enabled):
//   {
//     ok: true,
//     enabled: true,               // global game gate
//     modeEnabled: true,           // this mode's gate
//     mode: "wingo_30s",
//     minStake: 1, maxStake: 100000,
//     serverTime: "<ISO>",
//     round: {
//       periodNumber, phase: "open" | "closed",
//       secondsRemaining, startsAt, betCloseAt, drawsAt, serverSeedHash
//     },
//     next: { periodNumber, startsAt, betCloseAt, drawsAt },
//     results: [ { periodNumber, result, color, size, drawnAt }, ... ]
//   }
//
// Response (disabled): { ok: true, enabled: false, modeEnabled: false,
//   mode, minStake, maxStake, round: null, next: null, results: [] }.
//
// The route lazily ensures the current + next round exist and lazily
// settles any round past its draw for this mode, so the UI is correct
// even between cron ticks. Both operations are idempotent.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { isWingoMode, type WingoMode } from '@/lib/wingo/config';
import { ensureRounds, settleDueRounds, computeRoundWindow, roundWindowByIndex } from '@/lib/wingo/engine';
import { getRecentResults, WINGO_HISTORY_LIMIT } from '@/lib/wingo/read';
import { loadWingoSettings } from '@/lib/wingo/flag';

function phaseFor(betCloseMs: number, drawMs: number, nowMs: number): { phase: 'open' | 'closed'; secondsRemaining: number } {
  if (nowMs < betCloseMs) {
    return { phase: 'open', secondsRemaining: Math.max(0, Math.ceil((betCloseMs - nowMs) / 1000)) };
  }
  return { phase: 'closed', secondsRemaining: Math.max(0, Math.ceil((drawMs - nowMs) / 1000)) };
}

export async function GET(req: NextRequest) {
  const modeParam = (req.nextUrl.searchParams.get('mode') ?? '').trim();
  if (!isWingoMode(modeParam)) {
    return jsonError(400, 'WINGO_INVALID_MODE', 'Unknown WinGo mode.', { messageBn: 'অজানা উইনগো মোড।' });
  }
  const mode = modeParam as WingoMode;

  const settings = await loadWingoSettings();
  const nowIso = new Date().toISOString();

  // Global gate off, or this mode off: report a disabled state. The game
  // ships disabled by default until an admin turns it on.
  const modeEnabled = settings.enabled && settings.modes[mode];
  if (!settings.enabled || !modeEnabled) {
    return jsonOk({
      enabled: settings.enabled,
      modeEnabled,
      mode,
      minStake: settings.minStake,
      maxStake: settings.maxStake,
      serverTime: nowIso,
      round: null,
      next: null,
      results: [],
    });
  }

  // Lazy, idempotent: settle anything past its draw for this mode, then
  // make sure the current + next round rows exist.
  await settleDueRounds({ mode }).catch(() => undefined);
  const { current, next } = await ensureRounds(mode);

  // Recompute the live window from the wall clock. ensureRounds returns
  // the row for the window containing "now", so current always has
  // now < drawsAt (phase is open or closed, never past the draw).
  const nowMs = Date.now();
  const window = computeRoundWindow(mode, nowMs);
  const nextWindow = roundWindowByIndex(mode, window.index + 1);
  const { phase, secondsRemaining } = phaseFor(current.betCloseAt.getTime(), current.drawsAt.getTime(), nowMs);

  const results = await getRecentResults(mode, WINGO_HISTORY_LIMIT);

  return jsonOk({
    enabled: true,
    modeEnabled: true,
    mode,
    minStake: settings.minStake,
    maxStake: settings.maxStake,
    serverTime: nowIso,
    round: {
      roundId: current.id,
      periodNumber: current.periodNumber,
      phase,
      secondsRemaining,
      startsAt: current.startsAt.toISOString(),
      betCloseAt: current.betCloseAt.toISOString(),
      drawsAt: current.drawsAt.toISOString(),
      serverSeedHash: current.serverSeedHash,
    },
    next: {
      periodNumber: next.periodNumber,
      startsAt: nextWindow.startsAt.toISOString(),
      betCloseAt: nextWindow.betCloseAt.toISOString(),
      drawsAt: nextWindow.drawsAt.toISOString(),
    },
    results,
  });
}
