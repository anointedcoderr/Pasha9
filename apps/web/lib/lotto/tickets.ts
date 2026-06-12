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
import { loadLottoSettings } from './settings';

// M4 Phase F: live rate now comes from SystemSetting via
// loadLottoSettings(). These constants stay as the fallback when no
// settings row is present, and as the value of the LOTTERY_RULES
// snapshot exported below (still consumed by the public lotto card).
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
 *
 * Defensive trims: tickets stored with stray whitespace (operator
 * pasted "1234 " into the admin generator, or a database export
 * round-trip preserved a trailing newline) would silently fail
 * every === / .slice comparison below and return tier='none' even
 * though the digits matched. The audit flagged this as a real
 * source of "ticket matched but I got no credit" reports.
 */
export function computePrizeForTicket(rawTicket: string, rawWinning: string, prizes: PrizeStructure): PrizeCalc {
  const ticket = (rawTicket ?? '').trim();
  const winning = (rawWinning ?? '').trim();
  if (ticket.length !== winning.length) return { tier: 'none', amount: 0 };

  // 1st exact
  if (ticket === winning) {
    return { tier: 'first_exact', amount: round2(prizes.baseValue * prizes.firstMult) };
  }
  // 1st iBox (same multiset, different order). When every digit in
  // the winning number is identical (e.g. "1111"), uniquePermutations
  // is 1 and iBox is mathematically impossible - if it were a match
  // it would have been caught by the exact branch above. The audit
  // flagged a fallthrough where the function dropped into the
  // "special" check on the same ticket; making the no-op explicit
  // closes that path.
  if (isPermutation(ticket, winning)) {
    const unique = uniquePermutations(winning);
    if (unique > 1) {
      return { tier: 'first_ibox', amount: round2((prizes.baseValue * prizes.firstMult) / unique) };
    }
    // unique === 1: ticket digits permute to the winning digits, but
    // there is only one permutation - which the exact branch already
    // handled. If we got here, the exact comparison disagreed with
    // the permutation comparison, which can only happen on different
    // strings of identical multisets of length 1+ (impossible for
    // unique === 1). Treat as no-match rather than fall through.
    return { tier: 'none', amount: 0 };
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
  // Cutoff window: tickets generated within `cutoffMinutes` of drawsAt
  // do NOT join that draw. The next-future draw (or a new one seeded
  // by rollover) catches them instead. Default 10 minutes; admin can
  // adjust via the lotto_cutoff_minutes SystemSetting.
  const settings = await loadLottoSettings();
  const cutoffMs = Math.max(0, settings.cutoffMinutes) * 60 * 1000;
  const cutoffThreshold = new Date(now.getTime() + cutoffMs);
  const future = await db.lottoDraw.findFirst({
    where: { status: 'active', result: { is: null }, drawsAt: { gte: cutoffThreshold }, closedAt: null },
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
  // M4 Phase F: settings-driven rate. When lotto is disabled at the
  // admin layer we skip accrual entirely (preserves wallet credit but
  // no tickets are generated for the deposit). The existing deposit
  // hook still calls into here; this just makes it a no-op.
  const settings = await loadLottoSettings();
  if (!settings.enabled) {
    const existing = await db.lotteryTicket.count({ where: { userId, source: 'deposit_accrual' } });
    return { generated: 0, targetTotal: existing, existing };
  }
  const blockAmount = settings.ticketRateAmount;
  const ticketsPerBlock = settings.ticketRateCount;

  // Pre-resolve a candidate open draw OUTSIDE the transaction (the
  // lookup loads settings and applies the cutoff window - cheap
  // reads, no writes). The candidate is RE-VALIDATED inside the
  // transaction below before any ticket is written: a draw that
  // settles or closes between this read and the write is rejected
  // there, so tickets can no longer attach to a just-settled draw
  // and silently miss scoring (the "ticket matched the winning
  // number but I got 0 credit" race). Should the narrow
  // re-check-to-commit window still lose a race, rolloverDraws()
  // re-attaches issued tickets stuck on settled draws to the next
  // open draw, so the failure self-heals on the next cron tick.
  const candidate = await findOpenDraw();
  let candidateId: string | null = candidate?.id ?? null;
  if (!candidateId) {
    const ensured = await ensureDefaultDailyDraw();
    candidateId = ensured.draw.id;
  }
  if (!candidateId) {
    // Defensive: ensureDefaultDailyDraw should always return an id;
    // if it did not, do not proceed - bubble up so the caller sees
    // a real error instead of silently creating orphan tickets.
    throw new Error('LOTTO_NO_OPEN_DRAW_AVAILABLE');
  }

  // Atomize the (count, target, create) pipeline so two concurrent
  // deposit approvals for the same user cannot both observe
  // `existing < target` and double the createMany. Without the
  // transaction we would generate 2x the intended tickets the
  // moment two admins approve deposits at once for the same
  // player.
  return db.$transaction(async (tx) => {
    // Re-validate the candidate draw under the transaction: it must
    // still be active, unsettled and not closed at the moment the
    // tickets are written. Falls back to any other open draw, then
    // to seeding the canonical daily draw, so tickets always end up
    // with an OPEN drawId.
    let open = await tx.lottoDraw.findFirst({
      where: { id: candidateId, status: 'active', result: { is: null }, closedAt: null },
      select: { id: true },
    });
    if (!open) {
      open = await tx.lottoDraw.findFirst({
        where: { status: 'active', result: { is: null }, closedAt: null },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
    }
    if (!open) {
      const ensured = await ensureDefaultDailyDraw(tx);
      open = { id: ensured.draw.id };
    }
    const drawId = open.id;

    const agg = await tx.deposit.aggregate({
      where: { userId, status: 'approved' },
      _sum: { amount: true },
    });
    const totalApproved = Number(agg._sum.amount ?? 0);
    const targetTotal = Math.floor(totalApproved / blockAmount) * ticketsPerBlock;

    const existing = await tx.lotteryTicket.count({
      where: { userId, source: 'deposit_accrual' },
    });

    const toCreate = Math.max(0, targetTotal - existing);
    if (toCreate === 0) {
      return { generated: 0, targetTotal, existing };
    }

    const data = Array.from({ length: toCreate }, () => ({
      userId,
      drawId,
      number: randomTicketNumber(LOTTERY_RULES.digits),
      source: 'deposit_accrual',
    }));

    await tx.lotteryTicket.createMany({ data });
    return { generated: toCreate, targetTotal, existing };
  });
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
  // M4 Phase F additive Babu88-style display blob. Stored on the
  // result row but does not affect prize computation - the engine
  // still derives every prize tier from `winningNumber` and the
  // multipliers. The public lotto result history reads these and
  // renders them as separate prize cards when present.
  extraNumbers?: {
    second?: string | null;
    third?: string | null;
    specials?: string[];
    consolations?: string[];
  } | null;
  // M4 Phase F per-settle override of the global lotto_claim_mode.
  // 'auto' (default) credits Wallet.lottoBalance instantly. 'manual'
  // writes LotteryWinning rows with status='pending_credit' and the
  // player claims each ticket via /api/lotto/winnings/[id]/claim.
  // Undefined falls back to the SystemSetting value.
  claimMode?: 'auto' | 'manual';
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
  // M4 Phase F: the claim mode that took effect for this settlement.
  // 'auto' = lottoBalance credited inside the settle txn.
  // 'manual' = LotteryWinning rows wrote with status='pending_credit'.
  claimMode: 'auto' | 'manual';
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

  const settings = await loadLottoSettings();
  const claimMode: 'auto' | 'manual' = input.claimMode ?? settings.claimMode;
  const winningStatus = claimMode === 'manual' ? 'pending_credit' : 'credited';

  // Babu88-style display blob. Stored as-is on the result row when
  // provided; the public lotto card uses it to show 2nd / 3rd /
  // special / consolation numbers separately.
  const extraNumbersJson: Prisma.InputJsonValue | null = input.extraNumbers
    ? ({
        second: input.extraNumbers.second ?? null,
        third: input.extraNumbers.third ?? null,
        specials: Array.isArray(input.extraNumbers.specials) ? input.extraNumbers.specials : [],
        consolations: Array.isArray(input.extraNumbers.consolations) ? input.extraNumbers.consolations : [],
      } as Prisma.InputJsonValue)
    : null;

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
        extraNumbers: extraNumbersJson ?? Prisma.JsonNull,
        // Pin the effective claim mode on the result so late scoring
        // passes (score-orphans) credit winners the same way this
        // settlement did.
        claimMode,
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
          status: winningStatus,
          creditedAt: claimMode === 'auto' ? new Date() : null,
        })),
      });
    }

    // Mark every SCORED ticket as either "won" or "lost". The lost
    // flip is scoped to the ids read above rather than a blanket
    // { drawId, status: 'issued' } filter: a ticket accrued onto this
    // draw after the read would otherwise be flipped to "lost"
    // without ever being scored against the winning number. Left as
    // 'issued', the rolloverDraws() sweep re-attaches it to the next
    // open draw where it competes normally.
    const winningTicketIds = winningCalcs.map((row) => row.ticket.id);
    if (winningTicketIds.length > 0) {
      await tx.lotteryTicket.updateMany({
        where: { id: { in: winningTicketIds } },
        data: { status: 'won' },
      });
    }
    if (tickets.length > 0) {
      await tx.lotteryTicket.updateMany({
        where: { id: { in: tickets.map((t) => t.id) }, status: 'issued' },
        data: { status: 'lost' },
      });
    }

    // In auto-credit mode the wallet is bumped here. In manual mode
    // we leave Wallet.lottoBalance untouched; the player walks each
    // winning ticket through /api/lotto/winnings/[id]/claim which
    // does the credit + Transaction write inside its own txn.
    if (claimMode === 'auto') {
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
    claimMode,
  };
}

/**
 * Score orphan tickets (drawId=null OR drawId=this draw AND status='issued')
 * against an already-settled draw's result. This is the recovery path for the
 * "tickets matched the winning number but no credit" scenario, which happens
 * when tickets were generated before the draw existed (drawId=null) and the
 * operator later settled the draw with 0 attached tickets.
 *
 * Concurrency-safe idempotency: the orphan read AND the status flips
 * run inside one transaction, and every updateMany carries a
 * status='issued' guard with a count check. If two runs race (double
 * click, two admins), the loser's guarded update matches fewer rows
 * than it read, throws LOTTO_ORPHANS_ALREADY_SCORED and rolls back -
 * so wallets are credited exactly once. The unique index on
 * LotteryWinning.ticketId is the database-level backstop for the
 * same guarantee.
 *
 * Behaviour mirrors settleDraw's matching + credit path:
 *   - attach orphan tickets to this draw
 *   - flip every still-issued ticket to won or lost
 *   - create LotteryWinning rows for the winners
 *   - credit Wallet.lottoBalance (auto-credit mode) or leave
 *     pending_credit (manual mode)
 *   - increment LotteryDrawResult.totalWinners + totalPaid
 */
export async function scoreOrphanTicketsAgainstResult(input: {
  drawId: string;
}): Promise<{ attached: number; scored: number; winners: number; paid: number; alreadySettled: boolean }> {
  const draw = await db.lottoDraw.findUniqueOrThrow({
    where: { id: input.drawId },
    include: { result: true },
  });
  if (!draw.result) throw new Error('DRAW_NOT_SETTLED');
  const result = draw.result;

  const prizes: PrizeStructure = {
    baseValue: Number(result.ticketBaseValue),
    firstMult: Number(result.prize1xMult),
    secondMult: Number(result.prize2xMult),
    thirdMult: Number(result.prize3xMult),
    specialMult: Number(result.prizeSpecialMult),
    consoMult: Number(result.prizeConsoMult),
  };

  // The result row pins the claim mode that took effect when the draw
  // settled, so this late pass credits winners the same way the
  // original settlement did - NOT whatever the global
  // lotto_claim_mode happens to be today.
  const claimMode: 'auto' | 'manual' = result.claimMode === 'manual' ? 'manual' : 'auto';
  const winningStatus = claimMode === 'manual' ? 'pending_credit' : 'credited';

  return db.$transaction(async (tx) => {
    const orphans = await tx.lotteryTicket.findMany({
      where: {
        status: 'issued',
        OR: [
          { drawId: null },
          { drawId: input.drawId },
        ],
      },
    });
    if (orphans.length === 0) {
      return { attached: 0, scored: 0, winners: 0, paid: 0, alreadySettled: true };
    }

    const calcs = orphans.map((t) => ({
      ticket: t,
      calc: computePrizeForTicket(t.number, result.winningNumber, prizes),
    }));
    const winners = calcs.filter((r) => r.calc.tier !== 'none');
    const losers = calcs.filter((r) => r.calc.tier === 'none');
    const totalPaid = winners.reduce((sum, w) => sum + w.calc.amount, 0);

    // Per-user aggregate so each user's wallet is bumped once even if
    // they had multiple winning tickets.
    const perUser = new Map<string, number>();
    for (const w of winners) {
      perUser.set(w.ticket.userId, (perUser.get(w.ticket.userId) ?? 0) + w.calc.amount);
    }

    // 1+2. Attach orphans to this draw and flip their status in one
    // guarded write per outcome. The status='issued' guard plus the
    // count check is the double-credit lock: a concurrent run that
    // already claimed any of these rows makes the count fall short,
    // which aborts and rolls back this entire transaction before any
    // wallet is touched.
    if (winners.length > 0) {
      const claimed = await tx.lotteryTicket.updateMany({
        where: { id: { in: winners.map((w) => w.ticket.id) }, status: 'issued' },
        data: { drawId: input.drawId, status: 'won' },
      });
      if (claimed.count !== winners.length) {
        throw new Error('LOTTO_ORPHANS_ALREADY_SCORED');
      }
    }
    if (losers.length > 0) {
      const claimed = await tx.lotteryTicket.updateMany({
        where: { id: { in: losers.map((r) => r.ticket.id) }, status: 'issued' },
        data: { drawId: input.drawId, status: 'lost' },
      });
      if (claimed.count !== losers.length) {
        throw new Error('LOTTO_ORPHANS_ALREADY_SCORED');
      }
    }

    // 3. LotteryWinning rows for every winner.
    if (winners.length > 0) {
      await tx.lotteryWinning.createMany({
        data: winners.map((w) => ({
          userId: w.ticket.userId,
          resultId: result.id,
          ticketId: w.ticket.id,
          ticketNumber: w.ticket.number,
          prizeTier: w.calc.tier,
          amount: new Prisma.Decimal(w.calc.amount),
          status: winningStatus,
          creditedAt: claimMode === 'auto' ? new Date() : null,
        })),
      });
    }

    // 4. Wallet credit (auto mode).
    if (claimMode === 'auto') {
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
    }

    // 5. Bump result totals so the public history reflects the
    //    backfill instead of the original "0 winner, 0 paid" record.
    if (winners.length > 0) {
      await tx.lotteryDrawResult.update({
        where: { id: result.id },
        data: {
          totalWinners: { increment: winners.length },
          totalPaid: { increment: new Prisma.Decimal(totalPaid) },
        },
      });
    }

    return {
      attached: orphans.length,
      scored: calcs.length,
      winners: winners.length,
      paid: round2(totalPaid),
      alreadySettled: true,
    };
  }, { timeout: 30_000 });
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
 *   - accrueLotteryTickets(), which passes its transaction client so
 *     the seeded draw is created atomically with the tickets that
 *     need it
 */
export async function ensureDefaultDailyDraw(
  client: Prisma.TransactionClient | typeof db = db,
): Promise<{ draw: { id: string; name: string; drawsAt: Date | null }; created: boolean }> {
  const existing = await client.lottoDraw.findFirst({
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
  const created = await client.lottoDraw.create({
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
  rescued: number;
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

    // Attach any tickets that ended up with drawId=null (orphans
    // from a deposit approval before this draw existed, or a window
    // where every draw was already settled) to the newly seeded
    // draw. Without this attach the orphans stay in
    // /api/lotto/me as "Awaiting next draw" forever and never get
    // scored at settle time. Safe to run on every rollover.
    await db.lotteryTicket.updateMany({
      where: { drawId: null, status: 'issued' },
      data: { drawId: seeded.id },
    });
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
    // If the safety-net path is the one that ran, attach any
    // remaining orphans to the canonical draw so they can be
    // scored on settle.
    if (defaultDrawId) {
      await db.lotteryTicket.updateMany({
        where: { drawId: null, status: 'issued' },
        data: { drawId: defaultDrawId },
      });
    }
  }

  // Rescue sweep, every tick: tickets that are still 'issued' but
  // point at a draw that already HAS a result can never be scored by
  // that draw's settlement - they raced onto it in the moment it was
  // being settled. Re-attach them (plus any drawId=null stragglers
  // that survived the paths above) to an open draw so they compete
  // in the next settlement. Draws that are merely closed and awaiting
  // their settle keep their tickets.
  let rescued = 0;
  const rescueTarget = await db.lottoDraw.findFirst({
    where: { status: 'active', result: { is: null }, closedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  });
  if (rescueTarget) {
    const sweep = await db.lotteryTicket.updateMany({
      where: {
        status: 'issued',
        OR: [
          { drawId: null },
          { draw: { is: { result: { isNot: null } } } },
        ],
      },
      data: { drawId: rescueTarget.id },
    });
    rescued = sweep.count;
  }

  const messageParts: string[] = [];
  if (closedIds.length) messageParts.push(`closed ${closedIds.length}`);
  if (seededIds.length) messageParts.push(`seeded ${seededIds.length} next-day`);
  if (defaultSeeded) messageParts.push('seeded canonical Daily 4D (no active draw existed)');
  if (rescued) messageParts.push(`rescued ${rescued} stranded ticket(s) onto an open draw`);
  if (!closedIds.length && !seededIds.length && !defaultSeeded && !rescued) {
    messageParts.push('no past-due draws found; nothing to close, seed or rescue');
  }

  return {
    closed: closedIds.length,
    seeded: seededIds.length,
    closedIds,
    seededIds,
    activeAfter,
    defaultSeeded,
    defaultDrawId,
    rescued,
    message: messageParts.join(' . '),
  };
}
