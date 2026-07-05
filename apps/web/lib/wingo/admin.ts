// Built by Anointed Coder.
//
// Pasha WinGo admin read layer. Sits between the /api/admin/wingo route
// handlers and the database. Read-only: it never moves money. All wallet
// movement and settlement lives in the engine (do not touch it here).
//
// It surfaces three things the admin console needs:
//   - getWingoAdminOverview()      settings + per-mode audit totals
//   - listRecentWingoRounds(opts)  recent rounds with result + money
//   - getWingoRoundDetail(roundId) one round plus its bet lines

import { db } from '@/lib/db/client';
import { decryptString } from '@/lib/crypto/aead';
import {
  WINGO_MODES,
  WINGO_MODE_LIST,
  isWingoMode,
  type WingoMode,
} from './config';
import { loadWingoSettings, type WingoSettings } from './flag';

// Reveal the decrypted server seed ONLY for a settled round so an operator
// (or the player they are auditing) can recompute the draw. A not-yet
// settled round returns null: the seed must never surface early.
function revealSeed(status: string, blob: string | null | undefined): string | null {
  if (status !== 'settled' || !blob) return null;
  try {
    return decryptString(blob);
  } catch {
    return null;
  }
}

// ---------- Per-mode audit totals ----------

export interface WingoModeTotals {
  mode: WingoMode;
  labelEn: string;
  labelBn: string;
  enabled: boolean;
  rounds: number;
  rounds24h: number;
  lastDrawAt: string | null;
  totalStake: number;
  totalPayout: number;
  // Stake kept by the house = staked minus paid out.
  houseResult: number;
}

export interface WingoAdminOverview {
  settings: WingoSettings;
  modes: WingoModeTotals[];
}

// Overview for the admin console: the current settings plus a settled-
// round audit summary for each mode. Only settled rounds count toward the
// money totals so an in-flight round never distorts the house result.
export async function getWingoAdminOverview(): Promise<WingoAdminOverview> {
  const settings = await loadWingoSettings();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const modes = await Promise.all(
    WINGO_MODE_LIST.map(async (mode): Promise<WingoModeTotals> => {
      const [agg, rounds24h, last] = await Promise.all([
        db.wingoRound.aggregate({
          where: { mode, status: 'settled' },
          _count: { _all: true },
          _sum: { totalStake: true, totalPayout: true },
        }),
        db.wingoRound.count({ where: { mode, status: 'settled', drawnAt: { gte: since } } }),
        db.wingoRound.findFirst({
          where: { mode, status: 'settled' },
          orderBy: { drawsAt: 'desc' },
          select: { drawnAt: true },
        }),
      ]);
      const totalStake = Number(agg._sum.totalStake ?? 0);
      const totalPayout = Number(agg._sum.totalPayout ?? 0);
      const cfg = WINGO_MODES[mode];
      return {
        mode,
        labelEn: cfg.labelEn,
        labelBn: cfg.labelBn,
        enabled: settings.modes[mode],
        rounds: agg._count._all,
        rounds24h,
        lastDrawAt: last?.drawnAt ? last.drawnAt.toISOString() : null,
        totalStake,
        totalPayout,
        houseResult: totalStake - totalPayout,
      };
    }),
  );

  return { settings, modes };
}

// ---------- Recent rounds (audit list) ----------

export interface WingoAdminRoundRow {
  id: string;
  mode: string;
  periodNumber: string;
  status: string;
  result: number | null;
  resultColor: string | null;
  resultSize: string | null;
  betCount: number;
  totalStake: number;
  totalPayout: number;
  serverSeedHash: string;
  // Decrypted seed, exposed only on the round-detail view of a settled
  // round (null in the list view and for any not-yet-settled round).
  serverSeed: string | null;
  startsAt: string;
  betCloseAt: string;
  drawsAt: string;
  drawnAt: string | null;
  settledAt: string | null;
}

export interface ListRoundsOpts {
  mode?: WingoMode;
  status?: string; // open | closed | drawn | settled
  limit?: number;
}

const WINGO_ROUND_STATUSES = ['open', 'closed', 'drawn', 'settled'] as const;

export async function listRecentWingoRounds(opts: ListRoundsOpts = {}): Promise<WingoAdminRoundRow[]> {
  const take = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const mode = opts.mode && isWingoMode(opts.mode) ? opts.mode : undefined;
  const status = opts.status && (WINGO_ROUND_STATUSES as readonly string[]).includes(opts.status) ? opts.status : undefined;

  const rows = await db.wingoRound.findMany({
    where: {
      ...(mode ? { mode } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { drawsAt: 'desc' },
    take,
    select: {
      id: true,
      mode: true,
      periodNumber: true,
      status: true,
      result: true,
      resultColor: true,
      resultSize: true,
      betCount: true,
      totalStake: true,
      totalPayout: true,
      serverSeedHash: true,
      startsAt: true,
      betCloseAt: true,
      drawsAt: true,
      drawnAt: true,
      settledAt: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    mode: r.mode,
    periodNumber: r.periodNumber,
    status: r.status,
    result: r.result,
    resultColor: r.resultColor,
    resultSize: r.resultSize,
    betCount: r.betCount,
    totalStake: Number(r.totalStake),
    totalPayout: Number(r.totalPayout),
    serverSeedHash: r.serverSeedHash,
    // The list never reveals the seed; drill into the round detail for it.
    serverSeed: null,
    startsAt: r.startsAt.toISOString(),
    betCloseAt: r.betCloseAt.toISOString(),
    drawsAt: r.drawsAt.toISOString(),
    drawnAt: r.drawnAt ? r.drawnAt.toISOString() : null,
    settledAt: r.settledAt ? r.settledAt.toISOString() : null,
  }));
}

// ---------- Round drill-in (one round + its bet lines) ----------

export interface WingoAdminBetRow {
  id: string;
  userId: string;
  username: string | null;
  mode: string;
  betType: string;
  betValue: string;
  unitAmount: number;
  quantity: number;
  betAmount: number;
  status: string;
  payoutMultiplier: number;
  payoutAmount: number;
  settledAt: string | null;
  createdAt: string;
}

export interface WingoRoundDetail {
  round: WingoAdminRoundRow;
  bets: WingoAdminBetRow[];
}

export async function getWingoRoundDetail(roundId: string): Promise<WingoRoundDetail | null> {
  const round = await db.wingoRound.findUnique({
    where: { id: roundId },
    select: {
      id: true,
      mode: true,
      periodNumber: true,
      status: true,
      result: true,
      resultColor: true,
      resultSize: true,
      betCount: true,
      totalStake: true,
      totalPayout: true,
      serverSeed: true,
      serverSeedHash: true,
      startsAt: true,
      betCloseAt: true,
      drawsAt: true,
      drawnAt: true,
      settledAt: true,
    },
  });
  if (!round) return null;

  const betRows = await db.wingoBet.findMany({
    where: { roundId },
    orderBy: { createdAt: 'desc' },
    take: 500,
    include: { user: { select: { username: true } } },
  });

  const bets: WingoAdminBetRow[] = betRows.map((b) => ({
    id: b.id,
    userId: b.userId,
    username: b.user?.username ?? null,
    mode: b.mode,
    betType: b.betType,
    betValue: b.betValue,
    unitAmount: Number(b.unitAmount),
    quantity: b.quantity,
    betAmount: Number(b.betAmount),
    status: b.status,
    payoutMultiplier: Number(b.payoutMultiplier),
    payoutAmount: Number(b.payoutAmount),
    settledAt: b.settledAt ? b.settledAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
  }));

  return {
    round: {
      id: round.id,
      mode: round.mode,
      periodNumber: round.periodNumber,
      status: round.status,
      result: round.result,
      resultColor: round.resultColor,
      resultSize: round.resultSize,
      betCount: round.betCount,
      totalStake: Number(round.totalStake),
      totalPayout: Number(round.totalPayout),
      serverSeedHash: round.serverSeedHash,
      serverSeed: revealSeed(round.status, round.serverSeed),
      startsAt: round.startsAt.toISOString(),
      betCloseAt: round.betCloseAt.toISOString(),
      drawsAt: round.drawsAt.toISOString(),
      drawnAt: round.drawnAt ? round.drawnAt.toISOString() : null,
      settledAt: round.settledAt ? round.settledAt.toISOString() : null,
    },
    bets,
  };
}
