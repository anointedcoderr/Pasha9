// Built by Anointed Coder.
//
// Lottery service module. Two surfaces:
//
//   accrueLotteryTickets(userId) - run after a deposit is approved.
//     Idempotently brings the user's ticket count up to
//     floor(totalApprovedDeposits / 1200) * 2.
//
//   settleDraw(drawId, winningNumber, ...) - admin publishes the
//     winning number. Tickets attached to that draw are scored:
//       exact match    -> first prize        (base * 2000)
//       permutation    -> first prize / uniquePermCount  (iBox)
//     Winnings are written to LotteryWinning and the user's
//     Wallet.lottoBalance is incremented in the same transaction.
//
// Pure helpers (uniquePermutations, isPermutation, computeFirstPrize)
// are exported so the public lotto page and tests can use the same
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
  // n! / (count1! * count2! * ...)
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

export interface PrizeCalc {
  tier: 'first_exact' | 'first_ibox' | 'none';
  amount: number;
}

/**
 * Compute the prize for one ticket against a winning number.
 *
 * - exact match: full first-prize value
 * - any other permutation (iBox): first-prize value / uniquePermutationCount
 * - everything else: zero (other tiers ship in M2 with multi-number draws)
 */
export function computeFirstPrize(ticket: string, winning: string, baseValue: number, firstMult: number): PrizeCalc {
  if (ticket === winning) {
    return { tier: 'first_exact', amount: round2(baseValue * firstMult) };
  }
  if (isPermutation(ticket, winning)) {
    const unique = uniquePermutations(winning);
    if (unique <= 1) return { tier: 'none', amount: 0 };
    return { tier: 'first_ibox', amount: round2((baseValue * firstMult) / unique) };
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
    where: { status: 'active', result: { is: null }, drawsAt: { gte: now } },
    orderBy: { drawsAt: 'asc' },
  });
  if (future) return future;
  return db.lottoDraw.findFirst({
    where: { status: 'active', result: { is: null } },
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

export interface SettleResult {
  resultId: string;
  totalWinners: number;
  totalPaid: number;
}

/**
 * Publish the winning number for a draw and credit winnings.
 * Idempotent guard: throws if the draw already has a result.
 */
export async function settleDraw(input: SettleInput): Promise<SettleResult> {
  if (!/^\d{4}$/.test(input.winningNumber)) {
    throw new Error('Winning number must be exactly 4 digits');
  }

  const draw = await db.lottoDraw.findUniqueOrThrow({
    where: { id: input.drawId },
    include: { result: true },
  });
  if (draw.result) {
    throw new Error('Draw is already settled');
  }

  const baseValue = input.ticketBaseValue ?? Number(draw.ticketPrice);
  const firstMult = input.prize1xMult ?? 2000;
  const secondMult = input.prize2xMult ?? 800;
  const thirdMult = input.prize3xMult ?? 300;
  const specialMult = input.prizeSpecialMult ?? 150;
  const consoMult = input.prizeConsoMult ?? 30;

  const tickets = await db.lotteryTicket.findMany({
    where: { drawId: draw.id, status: 'issued' },
  });

  const winningCalcs = tickets
    .map((t) => ({ ticket: t, calc: computeFirstPrize(t.number, input.winningNumber, baseValue, firstMult) }))
    .filter((row) => row.calc.tier !== 'none');

  const totalPaid = winningCalcs.reduce((sum, row) => sum + row.calc.amount, 0);
  const totalWinners = winningCalcs.length;

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
        ticketBaseValue: new Prisma.Decimal(baseValue),
        prize1xMult: new Prisma.Decimal(firstMult),
        prize2xMult: new Prisma.Decimal(secondMult),
        prize3xMult: new Prisma.Decimal(thirdMult),
        prizeSpecialMult: new Prisma.Decimal(specialMult),
        prizeConsoMult: new Prisma.Decimal(consoMult),
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
      // Wallet may not exist yet; ensure it does.
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

    return created;
  });

  return { resultId: result.id, totalWinners, totalPaid };
}
