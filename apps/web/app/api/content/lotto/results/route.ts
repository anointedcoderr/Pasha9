// Built by Anointed Coder.
//
// Public lotto result history. M4 Phase F adds filtering:
//   ?from=YYYY-MM-DD   inclusive lower bound on publishedAt
//   ?to=YYYY-MM-DD     inclusive upper bound on publishedAt
//   ?range=yesterday|7d|30d  preset window (overridden by from/to)
//   ?take=N            max rows, capped at 100, default 30
//   ?skip=N            paging offset
//
// Returned rows now include the Phase F `extraNumbers` Babu88-style
// display blob when present so the public result history can render
// separate prize numbers per tier.

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { jsonOk } from '@/lib/auth/errors';

const MAX_TAKE = 100;
const DEFAULT_TAKE = 30;

function parseRange(range: string | null): { from: Date | null; to: Date | null } {
  if (!range) return { from: null, to: null };
  const now = new Date();
  if (range === 'yesterday') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 1);
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCHours(23, 59, 59, 999);
    return { from: start, to: end };
  }
  if (range === '7d') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    return { from: start, to: now };
  }
  if (range === '30d') {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 30);
    return { from: start, to: now };
  }
  return { from: null, to: null };
}

function parseDate(value: string | null, endOfDay = false): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setUTCHours(23, 59, 59, 999);
  return d;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const rangeWindow = parseRange(url.searchParams.get('range'));
  const fromExplicit = parseDate(url.searchParams.get('from'));
  const toExplicit = parseDate(url.searchParams.get('to'), true);
  const from = fromExplicit ?? rangeWindow.from;
  const to = toExplicit ?? rangeWindow.to;
  const take = Math.min(MAX_TAKE, Math.max(1, Number(url.searchParams.get('take') ?? DEFAULT_TAKE) || DEFAULT_TAKE));
  const skip = Math.max(0, Number(url.searchParams.get('skip') ?? 0) || 0);

  const where: Record<string, unknown> = {};
  if (from || to) {
    where.publishedAt = {
      ...(from ? { gte: from } : {}),
      ...(to ? { lte: to } : {}),
    };
  }

  const [rows, total] = await Promise.all([
    db.lotteryDrawResult.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take,
      include: { draw: { select: { id: true, name: true, schedule: true, drawsAt: true, accent: true } } },
    }),
    db.lotteryDrawResult.count({ where }),
  ]);

  return jsonOk({
    total,
    take,
    skip,
    range: { from, to },
    results: rows.map((r) => ({
      id: r.id,
      drawId: r.drawId,
      drawName: r.draw.name,
      drawSchedule: r.draw.schedule,
      drawAccent: r.draw.accent,
      drawsAt: r.draw.drawsAt,
      winningNumber: r.winningNumber,
      ticketBaseValue: Number(r.ticketBaseValue),
      prize1xMult: Number(r.prize1xMult),
      prize2xMult: Number(r.prize2xMult),
      prize3xMult: Number(r.prize3xMult),
      prizeSpecialMult: Number(r.prizeSpecialMult),
      prizeConsoMult: Number(r.prizeConsoMult),
      totalWinners: r.totalWinners,
      totalPaid: Number(r.totalPaid),
      extraNumbers: r.extraNumbers,
      publishedAt: r.publishedAt,
    })),
  });
}
