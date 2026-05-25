// Built by Anointed Coder.
//
// Lottery service module. Three surfaces:
//
//   accrueLotteryTickets(userId) - run after a deposit is approved.
//     Idempotently brings the user's ticket count up to
//     floor(totalApprovedDeposits / 1200) * 2.
//
//   settleDraw(input)           - admin publishes the winning number.
//     Tickets attached to that draw are scored across 6 prize tiers:
//       1st exact      4-digit exact match (full first multiplier)
//       1st iBox       same digits, any non-exact order
//                      (first multiplier / unique permutation count)
//       2nd            last 3 digits exact
//       3rd            last 2 digits exact
//       Special        first 2 digits exact
//       Consolation    numbers immediately adjacent to the winning
//                      number (winningNumber +/- 1, with 0000 <-> 9999
//                      wraparound)
//     Each ticket receives at MOST one winning row (highest-paying
//     tier wins; precedence: 1st_exact > 1st_ibox > special > 2nd
//     > 3rd > consolation).
//     Idempotency guard: throws DRAW_ALREADY_SETTLED if the draw
//     already has a result row.
//
//   rolloverDraws()             - cron-triggered.
//     Closes every draw whose drawsAt is in the past and has no
//     result yet (sets closedAt). Optionally seeds the next draw
//     when a draw with the same name + schedule does not exist
//     for the upcoming slot. Returns counts for observability.
//
// Pure helpers (uniquePermutations, isPermutation, computeFirstPrize,
// computePrizeForTicket, adjacentNumbers) are exported so the public
// lotto page, the admin diagnose modal, and tests can use the same
// math the settlement uses.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

const TICKETS_PER_BLOCK = 2;
const BLOCK_AMOUNT = 1200;

export const LOTTERY_RULES = {
  ticketsPerBlock: TICKETS_PER_BLOCK,
  blockAmount: BLOCK_AMOUNT,
  digits: 4,
  drawTimeLabel: 'Daily 19:30 BST',
} as const;

export type PrizeTier =
  | 'first_exact'
  | 'first_ibox'
  | 'second'
  | 'third'
  | 'special'
  | 'consolation'
  | 'none';

export const PRIZE_TIER_ORDER: PrizeTier[] = [
  'first_exact',
  'first_ibox',
  'special',
  'second',
  'third',
  'consolation',
];

export const PRIZE_TIER_LABELS: Record<Exclude<PrizeTier, 'none'>, string> = {
  first_exact: '1st prize (exact)',
  first_ibox: '1st prize (iBox)',
  second: '2nd prize (last 3 digits)',
  third: '3rd prize (last 2 digits)',
  special: 'Special (first 2 digits)',
  consolation: 'Consolation (adjacent number)',
};

/** Generate a random 4-digit string with leading zeros preserved. */
export function randomTicketNumber(digits = 4): string {
  const max = 10 ** digits;
  return Math.floor(Math.random() * max).toString().padStart(digits, '0');
}

/** Count unique permutations of a digit string. E.g. "1111" -> 1, "1122" -> 6, "1234" -> 24. */
export function uniquePermutations(digits: string): number {
  const counts = new Map<string, number>();
  for (const d of digits) counts.set(d, (counts.get(d) ?? 0) + 1);
  const n = digits.length;
  let result = factorial(n);
  for (const c of counts.values()) result /= factorial(c);
  return result;
}

function factorial(n: number): number {
  let acc = 1;
  for (let i = 2; i <= n; i += 1) acc *= i;
  return acc;
}

/** True when `a` is a permutation of `b` (same multiset of digits, same length). */
export function isPermutation(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ka = a.split('').sort().join('');
  const kb = b.split('').sort().join('');
  return ka === kb;
}

/** Returns the two adjacent 4-digit strings (winning-1 and winning+1) with wraparound. */
export function adjacentNumbers(winning: string, digits = 4): string[] {
  const mod = 10 ** digits;
  const n = parseInt(winning, 10);
  if (Number.isNaN(n)) return [];
  const minus = ((n - 1) + mod) % mod;
  const plus = (n + 1) % mod;
  return [minus.toString().padStart(digits, '0'), plus.toString().padStart(digits, '0')];
}

export interface PrizeCalc {
  tier: PrizeTier;
  amount: number;
}

/** Back-compat: returns only the 1st-prize portion (exact + iBox). */
export function computeFirstPrize(ticket: string, winning: string, baseValue: number, firstMult: number): PrizeCalc {
  if (ticket === winning) return { tier: 'first_exact', amount: round2(baseValue * firstMult) };
  if (isPermutation(ticket, winning)) {
    const unique = uniquePermutations(winning);
    if (unique <= 1) return { tier: 'none', amount: 0 };
    return { tier: 'first_ibox', amount: round2((baseValue * firstMult) / unique) };
  }
  return { tier: 'none', amount: 0 };
}

export interface PrizeStructure {
  baseValue: number;
  firstMult: number;
  secondMult: number;
  thirdMult: number;
  specialMult: number;
  consoMult: number;
}

/**
 * Score one ticket against the winning number across all 6 tiers.
 * Returns the single highest-paying tier (no double-pay across tiers).
 * Precedence: 1st_exact > 1st_ibox > special > 2nd > 3rd > consolation.
 */
export function computePrizeForTicket(ticket: string, winning: string, prizes: PrizeStructure): PrizeCalc {
  if (ticket.length !== winning.length) return { tier: 'none', amount: 0 };

  // 1st exact
  if (ticket === winning) {
    return { tier: 'first_exact', amount: round2(prizes.baseValue * prizes.firstMult) };
  }
  // 1st iBox (same multiset, different order)
  if (isPermutation(ticket, winning)) {
    const unique = uniquePermutations(winning);
    if (unique > 1) {
      return { tier: 'first_ibox', amount: round2((prizes.baseValue * prizes.firstMult) / unique) };
    }
  }
  // Special: first 2 digits exact (and not already qualified above)
  if (prizes.specialMult > 0 && ticket.slice(0, 2) === winning.slice(0, 2)) {
    return { tier: 'special', amount: round2(prizes.baseValue * prizes.specialMult) };
  }
  // 2nd: last 3 digits exact
  if (prizes.secondMult > 0 && ticket.slice(-3) === winning.slice(-3)) {
    return { tier: 'second', amount: round2(prizes.baseValue * prizes.secondMult) };
  }
  // 3rd: last 2 digits exact
  if (prizes.thirdMult > 0 && ticket.slice(-2) === winning.slice(-2)) {
    return { tier: 'third', amount: round2(prizes.baseValue * prizes.thirdMult) };
  }
  // Consolation: numbers immediately adjacent to the winning number
  if (prizes.consoMult > 0) {
    const neighbors = adjacentNumbers(winning, winning.length);
    if (neighbors.includes(ticket)) {
      return { tier: 'consolation', amount: round2(prizes.baseValue * prizes.consoMult) };
    }
  }
  return { tier: 'none', amount: 0 };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Find or create the current "open" draw - a LottoDraw whose status is
 * active and which has not yet been settled (no LotteryDrawResult).
 * Picks the soonest future drawsAt; falls back to any open draw.
 */
async function findOpenDraw() {
  const now = new Date();
  const future = await db.lottoDraw.findFirst({
    where: { status: 'active', result: { is: null }, drawsAt: { gte: now }, closedAt: null },
    orderBy: { drawsAt: 'asc' },
  });
  if (future) return future;
  return db.lottoDraw.findFirst({
    where: { status: 'active', result: { is: null }, closedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Bring the user's ticket count up to floor(totalApprovedDeposits / 1200) * 2.
 *
 * Idempotent: if called twice in a row with no new deposits in between
 * it will not generate extra tickets. Returns the number of tickets
 * newly created.
 */
export async function accrueLotteryTickets(userId: string): Promise<{ generated: number; targetTotal: number; existing: number }> {
  const agg = await db.deposit.aggregate({
    where: { userId, status: 'approved' },
    _sum: { amount: true },
  });
  const totalApproved = Number(agg._sum.amount ?? 0);
  const targetTotal = Math.floor(totalApproved / BLOCK_AMOUNT) * TICKETS_PER_BLOCK;

  const existing = await db.lotteryTicket.count({
    where: { userId, source: 'deposit_accrual' },
  });

  const toCreate = Math.max(0, targetTotal - existing);
  if (toCreate === 0) {
    return { generated: 0, targetTotal, existing };
  }

  const openDraw = await findOpenDraw();
  const drawId = openDraw?.id ?? null;

  const data = Array.from({ length: toCreate }, () => ({
    userId,
    drawId,
    number: randomTicketNumber(LOTTERY_RULES.digits),
    source: 'deposit_accrual',
  }));

  await db.lotteryTicket.createMany({ data });
  return { generated: toCreate, targetTotal, existing };
}

export interface SettleInput {
  drawId: string;
  winningNumber: string;
  publishedById?: string;
  ticketBaseValue?: number;
  prize1xMult?: number;
  prize2xMult?: number;
  prize3xMult?: number;
  prizeSpecialMult?: number;
  prizeConsoMult?: number;
}

export interface TierBreakdown {
  tier: Exclude<PrizeTier, 'none'>;
  label: string;
  count: number;
  paid: number;
}

export interface SettleResult {
  resultId: string;
  totalWinners: number;
  totalPaid: number;
  breakdown: TierBreakdown[];
  uniqueWinners: number;
}

/**
 * Publish the winning number for a draw and credit winnings.
 * Throws Error('DRAW_ALREADY_SETTLED') if the draw already has a result.
 */
export async function settleDraw(input: SettleInput): Promise<SettleResult> {
  if (!/^\d{4}$/.test(input.winningNumber)) {
    throw new Error('WINNING_NUMBER_INVALID');
  }

  const draw = await db.lottoDraw.findUniqueOrThrow({
    where: { id: input.drawId },
    include: { result: true },
  });
  if (draw.result) {
    throw new Error('DRAW_ALREADY_SETTLED');
  }

  const prizes: PrizeStructure = {
    baseValue: input.ticketBaseValue ?? Number(draw.ticketPrice),
    firstMult: input.prize1xMult ?? 2000,
    secondMult: input.prize2xMult ?? 800,
    thirdMult: input.prize3xMult ?? 300,
    specialMult: input.prizeSpecialMult ?? 150,
    consoMult: input.prizeConsoMult ?? 30,
  };

  const tickets = await db.lotteryTicket.findMany({
    where: { drawId: draw.id, status: 'issued' },
  });

  const winningCalcs = tickets
    .map((t) => ({ ticket: t, calc: computePrizeForTicket(t.number, input.winningNumber, prizes) }))
    .filter((row) => row.calc.tier !== 'none');

  const totalPaid = winningCalcs.reduce((sum, row) => sum + row.calc.amount, 0);
  const totalWinners = winningCalcs.length;

  // Per-tier breakdown for the admin UI + ActivityLog.
  const breakdownMap = new Map<Exclude<PrizeTier, 'none'>, { count: number; paid: number }>();
  for (const row of winningCalcs) {
    const tier = row.calc.tier as Exclude<PrizeTier, 'none'>;
    const cur = breakdownMap.get(tier) ?? { count: 0, paid: 0 };
    cur.count += 1;
    cur.paid += row.calc.amount;
    breakdownMap.set(tier, cur);
  }
  const breakdown: TierBreakdown[] = PRIZE_TIER_ORDER
    .filter((t): t is Exclude<PrizeTier, 'none'> => t !== 'none')
    .map((tier) => {
      const m = breakdownMap.get(tier) ?? { count: 0, paid: 0 };
      return { tier, label: PRIZE_TIER_LABELS[tier], count: m.count, paid: round2(m.paid) };
    });

  // Group winnings per user so each user's wallet is bumped once.
  const perUser = new Map<string, number>();
  for (const row of winningCalcs) {
    perUser.set(row.ticket.userId, (perUser.get(row.ticket.userId) ?? 0) + row.calc.amount);
  }

  const result = await db.$transaction(async (tx) => {
    const created = await tx.lotteryDrawResult.create({
      data: {
        drawId: draw.id,
        winningNumber: input.winningNumber,
        ticketBaseValue: new Prisma.Decimal(prizes.baseValue),
        prize1xMult: new Prisma.Decimal(prizes.firstMult),
        prize2xMult: new Prisma.Decimal(prizes.secondMult),
        prize3xMult: new Prisma.Decimal(prizes.thirdMult),
        prizeSpecialMult: new Prisma.Decimal(prizes.specialMult),
        prizeConsoMult: new Prisma.Decimal(prizes.consoMult),
        publishedById: input.publishedById,
        totalWinners,
        totalPaid: new Prisma.Decimal(totalPaid),
      },
    });

    if (winningCalcs.length > 0) {
      await tx.lotteryWinning.createMany({
        data: winningCalcs.map((row) => ({
          userId: row.ticket.userId,
          resultId: created.id,
          ticketId: row.ticket.id,
          ticketNumber: row.ticket.number,
          prizeTier: row.calc.tier,
          amount: new Prisma.Decimal(row.calc.amount),
          status: 'credited',
          creditedAt: new Date(),
        })),
      });
    }

    // Mark every issued ticket from this draw as either "won" or "lost".
    const winningTicketIds = winningCalcs.map((row) => row.ticket.id);
    if (winningTicketIds.length > 0) {
      await tx.lotteryTicket.updateMany({
        where: { id: { in: winningTicketIds } },
        data: { status: 'won' },
      });
    }
    await tx.lotteryTicket.updateMany({
      where: { drawId: draw.id, status: 'issued' },
      data: { status: 'lost' },
    });

    // Credit user lotto wallets in one shot per user.
    for (const [userId, amount] of perUser.entries()) {
      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (wallet) {
        await tx.wallet.update({
          where: { userId },
          data: { lottoBalance: { increment: new Prisma.Decimal(amount) } },
        });
      } else {
        await tx.wallet.create({
          data: { userId, lottoBalance: new Prisma.Decimal(amount) },
        });
      }
    }

    // Stamp the draw with settledAt so the rollover cron can leave it alone.
    await tx.lottoDraw.update({
      where: { id: draw.id },
      data: { settledAt: new Date(), closedAt: draw.closedAt ?? new Date() },
    });

    return created;
  });

  return {
    resultId: result.id,
    totalWinners,
    totalPaid: round2(totalPaid),
    uniqueWinners: perUser.size,
    breakdown,
  };
}

/**
 * Dry-run scorer for the admin diagnose modal. Same logic as
 * settleDraw but writes nothing. Useful to verify a winning number
 * + multipliers before pulling the trigger on real wallet credits.
 */
export async function diagnoseSettlement(drawId: string, winningNumber: string, overrides?: Partial<PrizeStructure>): Promise<{
  drawName: string;
  ticketCount: number;
  alreadySettled: boolean;
  totalWinners: number;
  totalPaid: number;
  uniqueWinners: number;
  breakdown: TierBreakdown[];
  samples: Array<{ ticket: string; tier: PrizeTier; amount: number }>;
}> {
  const draw = await db.lottoDraw.findUniqueOrThrow({ where: { id: drawId }, include: { result: true } });
  const prizes: PrizeStructure = {
    baseValue: overrides?.baseValue ?? Number(draw.ticketPrice),
    firstMult: overrides?.firstMult ?? 2000,
    secondMult: overrides?.secondMult ?? 800,
    thirdMult: overrides?.thirdMult ?? 300,
    specialMult: overrides?.specialMult ?? 150,
    consoMult: overrides?.consoMult ?? 30,
  };

  const tickets = await db.lotteryTicket.findMany({
    where: { drawId, status: 'issued' },
    select: { id: true, userId: true, number: true },
  });

  const calcs = tickets.map((t) => ({ ticket: t, calc: computePrizeForTicket(t.number, winningNumber, prizes) }));
  const winning = calcs.filter((r) => r.calc.tier !== 'none');

  const perUser = new Set<string>();
  const breakdownMap = new Map<Exclude<PrizeTier, 'none'>, { count: number; paid: number }>();
  for (const w of winning) {
    perUser.add(w.ticket.userId);
    const tier = w.calc.tier as Exclude<PrizeTier, 'none'>;
    const cur = breakdownMap.get(tier) ?? { count: 0, paid: 0 };
    cur.count += 1;
    cur.paid += w.calc.amount;
    breakdownMap.set(tier, cur);
  }
  const breakdown: TierBreakdown[] = PRIZE_TIER_ORDER
    .filter((t): t is Exclude<PrizeTier, 'none'> => t !== 'none')
    .map((tier) => {
      const m = breakdownMap.get(tier) ?? { count: 0, paid: 0 };
      return { tier, label: PRIZE_TIER_LABELS[tier], count: m.count, paid: round2(m.paid) };
    });

  return {
    drawName: draw.name,
    ticketCount: tickets.length,
    alreadySettled: !!draw.result,
    totalWinners: winning.length,
    totalPaid: round2(winning.reduce((s, r) => s + r.calc.amount, 0)),
    uniqueWinners: perUser.size,
    breakdown,
    samples: winning.slice(0, 10).map((r) => ({ ticket: r.ticket.number, tier: r.calc.tier, amount: r.calc.amount })),
  };
}

// M2F hotfix: the spec for the default lottery draw. Used by the
// seed endpoint AND by rolloverDraws() when it cannot find any
// active draw at all, so the platform is never left in a "nothing
// to settle" state. Ticket price + multipliers are intentionally
// the canonical M1 defaults so existing reports / docs stay valid.
export const DEFAULT_DAILY_DRAW = {
  name: 'Daily 4D',
  schedule: 'Daily 19:30 BST',
  digitsCount: 4,
  ticketPrice: 20,
  prizePool: 100_000,
  accent: 'yellow' as const,
  position: 1,
  // Prize multipliers documented next to the schedule. These match
  // the public lotto page copy. Used as the default body of the
  // settle modal, NOT stored on LottoDraw (the schema holds them on
  // LotteryDrawResult so historical settlements stay accurate).
  defaultMultipliers: {
    first: 2000,
    second: 800,
    third: 300,
    special: 150,
    consolation: 30,
  },
};

// Computes the next 19:30 server-local timestamp. If 19:30 has not
// passed yet today, returns today at 19:30; otherwise returns
// tomorrow at 19:30.
function nextDailyDrawAt(): Date {
  const next = new Date();
  next.setHours(19, 30, 0, 0);
  if (next <= new Date()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

/**
 * Idempotent default-draw seeder. If an active, non-closed,
 * non-settled draw with the canonical name already exists, returns
 * it. Otherwise creates one for the next 7:30 PM slot.
 *
 * Used by:
 *   - the admin "Create Daily 4D Draw" empty-state button
 *   - rolloverDraws(), so a misconfigured deploy self-heals on the
 *     first cron tick
 */
export async function ensureDefaultDailyDraw(): Promise<{ draw: { id: string; name: string; drawsAt: Date | null }; created: boolean }> {
  const existing = await db.lottoDraw.findFirst({
    where: {
      name: DEFAULT_DAILY_DRAW.name,
      status: 'active',
      result: { is: null },
      closedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    return { draw: { id: existing.id, name: existing.name, drawsAt: existing.drawsAt }, created: false };
  }
  const drawsAt = nextDailyDrawAt();
  const created = await db.lottoDraw.create({
    data: {
      name: DEFAULT_DAILY_DRAW.name,
      schedule: DEFAULT_DAILY_DRAW.schedule,
      drawsAt,
      digitsCount: DEFAULT_DAILY_DRAW.digitsCount,
      ticketPrice: new Prisma.Decimal(DEFAULT_DAILY_DRAW.ticketPrice),
      prizePool: new Prisma.Decimal(DEFAULT_DAILY_DRAW.prizePool),
      accent: DEFAULT_DAILY_DRAW.accent,
      position: DEFAULT_DAILY_DRAW.position,
      status: 'active',
    },
  });
  return { draw: { id: created.id, name: created.name, drawsAt: created.drawsAt }, created: true };
}

/**
 * Rollover sweep, intended to be triggered by a daily cron at the
 * cut-off time (7:30 PM by default).
 *
 * For every active draw with drawsAt in the past and no result yet:
 *   - sets closedAt = now() so accrueLotteryTickets() will no longer
 *     attach new tickets to that draw
 *
 * For every active draw that is now closed without a successor:
 *   - schedules the next instance the day after (same name, schedule,
 *     ticket price, accent) with drawsAt = now() + 1 day at the same
 *     hour/minute. This means the public lotto page always has a
 *     forward-looking active draw to attach new tickets to.
 *
 * M2F hotfix: when the sweep finds zero past-due draws AND zero
 * active draws exist at all, it calls ensureDefaultDailyDraw() so
 * the platform is never silently empty. The response carries a
 * defaultSeeded flag for the admin UI / cron log.
 */
export async function rolloverDraws(): Promise<{
  closed: number;
  seeded: number;
  closedIds: string[];
  seededIds: string[];
  activeAfter: number;
  defaultSeeded: boolean;
  defaultDrawId: string | null;
  message: string;
}> {
  const now = new Date();
  const closedIds: string[] = [];
  const seededIds: string[] = [];

  const due = await db.lottoDraw.findMany({
    where: {
      status: 'active',
      result: { is: null },
      closedAt: null,
      drawsAt: { lt: now, not: null },
    },
  });

  for (const d of due) {
    await db.lottoDraw.update({
      where: { id: d.id },
      data: { closedAt: now },
    });
    closedIds.push(d.id);

    // Schedule next instance (24h later, same time-of-day) if there
    // is no other open draw with the same name already.
    const existingOpen = await db.lottoDraw.findFirst({
      where: { name: d.name, status: 'active', result: { is: null }, closedAt: null, id: { not: d.id } },
    });
    if (existingOpen) continue;

    const nextDrawsAt = d.drawsAt
      ? new Date(d.drawsAt.getTime() + 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const seeded = await db.lottoDraw.create({
      data: {
        name: d.name,
        schedule: d.schedule,
        drawsAt: nextDrawsAt,
        digitsCount: d.digitsCount,
        ticketPrice: d.ticketPrice,
        prizePool: d.prizePool,
        accent: d.accent,
        position: d.position,
        status: 'active',
      },
    });
    seededIds.push(seeded.id);
  }

  // Safety net: if the sweep was a no-op AND no active draw exists
  // anywhere, seed the canonical Daily 4D so accrual + settlement
  // always have a target. Idempotent (returns existing if present).
  let defaultSeeded = false;
  let defaultDrawId: string | null = null;
  let activeAfter = await db.lottoDraw.count({
    where: { status: 'active', result: { is: null }, closedAt: null },
  });
  if (activeAfter === 0) {
    const ensured = await ensureDefaultDailyDraw();
    defaultSeeded = ensured.created;
    defaultDrawId = ensured.draw.id;
    activeAfter = 1;
  }

  const messageParts: string[] = [];
  if (closedIds.length) messageParts.push(`closed ${closedIds.length}`);
  if (seededIds.length) messageParts.push(`seeded ${seededIds.length} next-day`);
  if (defaultSeeded) messageParts.push('seeded canonical Daily 4D (no active draw existed)');
  if (!closedIds.length && !seededIds.length && !defaultSeeded) {
    messageParts.push('no past-due draws found; nothing to close or seed');
  }

  return {
    closed: closedIds.length,
    seeded: seededIds.length,
    closedIds,
    seededIds,
    activeAfter,
    defaultSeeded,
    defaultDrawId,
    message: messageParts.join(' . '),
  };
}
