// Built by Anointed Coder.
//
// Pasha WinGo read helpers for the player surfaces: the recent-results
// history strip and the "My history" feed. Read-only, no wallet moves.

import { db } from '@/lib/db/client';
import { decryptString } from '@/lib/crypto/aead';
import { resultColorIdentity, resultSize } from './paytable';
import { type WingoMode } from './config';

// How many recent settled results the history strip returns by default.
export const WINGO_HISTORY_LIMIT = 20;

// Reveal the decrypted server seed ONLY for a fully settled round, so a
// third party can recompute result = derive(seed, periodNumber) and audit
// the draw. Any not-yet-settled round (open|closed|drawn) returns null: the
// seed must never leak while the round could still be influenced or paid.
function revealSeed(status: string, blob: string | null | undefined): string | null {
  if (status !== 'settled' || !blob) return null;
  try {
    return decryptString(blob);
  } catch {
    return null;
  }
}

export interface WingoResultRow {
  periodNumber: string;
  result: number;
  color: string; // red | green | red_violet | green_violet
  size: string; // big | small
  drawnAt: string | null;
  // Provably-fair commit + reveal. serverSeed is the decrypted seed, non
  // null here because every returned row is settled.
  serverSeedHash: string;
  serverSeed: string | null;
}

// The last N settled results for a mode, newest first. Feeds the
// history strip mini-balls and the Game history / Chart tabs.
export async function getRecentResults(mode: WingoMode, limit = WINGO_HISTORY_LIMIT): Promise<WingoResultRow[]> {
  const take = Math.min(Math.max(limit, 1), 100);
  const rows = await db.wingoRound.findMany({
    where: { mode, status: 'settled', result: { not: null } },
    orderBy: { drawsAt: 'desc' },
    take,
    select: { periodNumber: true, result: true, resultColor: true, resultSize: true, drawnAt: true, status: true, serverSeed: true, serverSeedHash: true },
  });
  return rows.map((r) => ({
    periodNumber: r.periodNumber,
    result: r.result as number,
    color: r.resultColor ?? resultColorIdentity(r.result as number),
    size: r.resultSize ?? resultSize(r.result as number),
    drawnAt: r.drawnAt ? r.drawnAt.toISOString() : null,
    serverSeedHash: r.serverSeedHash,
    serverSeed: revealSeed(r.status, r.serverSeed),
  }));
}

export interface WingoMyBetRow {
  id: string;
  roundId: string;
  mode: string;
  periodNumber: string;
  betType: string;
  selection: string;
  stake: number;
  quantity: number;
  betAmount: number;
  status: string; // PENDING | WON | LOST | REFUNDED
  payoutMultiplier: number;
  payoutAmount: number;
  result: number | null;
  resultColor: string | null;
  resultSize: string | null;
  roundStatus: string;
  drawsAt: string;
  createdAt: string;
  settledAt: string | null;
  // Provably-fair: hash is public from open; the decrypted seed is exposed
  // only once the round is settled so the player can audit the draw.
  serverSeedHash: string;
  serverSeed: string | null;
}

export interface ListUserBetsOpts {
  mode?: WingoMode;
  limit?: number;
  // Keyset pagination: pass the createdAt ISO string of the last row.
  before?: string;
}

// A player's WinGo bets, newest first, with the round's drawn result
// joined in so the UI can show the outcome without a second call.
export async function listUserBets(userId: string, opts: ListUserBetsOpts = {}): Promise<{ bets: WingoMyBetRow[]; nextBefore: string | null }> {
  const take = Math.min(Math.max(opts.limit ?? 20, 1), 50);
  const before = opts.before ? new Date(opts.before) : null;
  const rows = await db.wingoBet.findMany({
    where: {
      userId,
      ...(opts.mode ? { mode: opts.mode } : {}),
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    include: {
      round: { select: { periodNumber: true, result: true, resultColor: true, resultSize: true, status: true, drawsAt: true, serverSeed: true, serverSeedHash: true } },
    },
  });

  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const bets: WingoMyBetRow[] = page.map((b) => ({
    id: b.id,
    roundId: b.roundId,
    mode: b.mode,
    periodNumber: b.round.periodNumber,
    betType: b.betType,
    selection: b.betValue,
    stake: Number(b.unitAmount),
    quantity: b.quantity,
    betAmount: Number(b.betAmount),
    status: b.status,
    payoutMultiplier: Number(b.payoutMultiplier),
    payoutAmount: Number(b.payoutAmount),
    result: b.round.result,
    resultColor: b.round.resultColor,
    resultSize: b.round.resultSize,
    roundStatus: b.round.status,
    drawsAt: b.round.drawsAt.toISOString(),
    createdAt: b.createdAt.toISOString(),
    settledAt: b.settledAt ? b.settledAt.toISOString() : null,
    serverSeedHash: b.round.serverSeedHash,
    serverSeed: revealSeed(b.round.status, b.round.serverSeed),
  }));

  const nextBefore = hasMore ? page[page.length - 1].createdAt.toISOString() : null;
  return { bets, nextBefore };
}
