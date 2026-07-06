// Built by Anointed Coder.
//
// WinGo Tournament engine. The money-critical core of the honest
// player-engagement suite. Mirrors the cashback engine blueprint
// (lib/cashback/engine.ts) and the WinGo settlement idempotency
// (lib/wingo/engine.ts): a single GUARDED status transition settles a
// tournament and every prize is credited EXACTLY ONCE, keyed by a
// unique idempotencyKey, so a re-run - or a crash mid-settlement - can
// never double-pay and always resumes to pay only the remainder.
//
// Scope: WinGo only. Ranking metric: TOTAL WAGERED = the sum of
// WingoBet.betAmount by each player whose createdAt falls in
// [startsAt, endsAt). REFUNDED bets (rounds voided, stake returned) are
// excluded because that volume was never truly wagered.
//
// Lifecycle: draft -> active -> ended -> paid, plus a terminal 'void'.
//   draft   scheduled; startsAt in the future (admin may edit/delete)
//   active  now in [startsAt, endsAt); leaderboard is live
//   ended   now >= endsAt; leaderboard frozen, awaiting settlement
//   paid    settlement credited the winners
//   void    admin voided before payout; never pays
//
// Deterministic strict ranking (documented in the leaderboard UI so it
// is transparent): order by score DESC, then earliest activity (the
// min createdAt of the user's qualifying bets) ASC, then userId ASC.
// Strict ranks 1..N are assigned with no ties, so a prize maps to
// exactly one winner.
//
// Prize crediting mirrors the cashback grant transaction shape: the
// prize lands as REAL BDT in Wallet.balance, an optional per-tournament
// turnoverX lock is tracked by a UserBonus row of sourceType
// 'tournament_prize' (a DIRECT_BALANCE_LOCK_SOURCES member the
// withdrawal gate subtracts from withdrawable funds until wagered), a
// Transaction of type 'bonus' with meta.kind='tournament_prize' shows
// in wallet history, and a Notification is delivered to the winner.
// turnoverX = 0 means pure cash: no lock, no UserBonus row.

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';

type Tx = Prisma.TransactionClient;

const dec = (n: number | string | Prisma.Decimal) => new Prisma.Decimal(n);

// WingoBet.status values that count as real wagered volume. REFUNDED is
// a voided round whose stake was returned, so it must NOT count.
const WAGER_STATUSES = ['PENDING', 'WON', 'LOST'];

// ---------- Prize table ----------

export interface PrizeSlot {
  rank: number;
  amount: number;
}

// Coerce the Tournament.prizes JSON column into a clean, ascending-rank
// PrizeSlot[]. Silently drops malformed entries; the admin API is the
// authority that validates ranks 1..N contiguous + unique + amount > 0
// at write time, so a well-formed row round-trips unchanged.
export function parsePrizes(raw: Prisma.JsonValue | null | undefined): PrizeSlot[] {
  if (!Array.isArray(raw)) return [];
  const out: PrizeSlot[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const rec = entry as Record<string, unknown>;
    const rank = Number(rec.rank);
    const amount = Number(rec.amount);
    if (!Number.isInteger(rank) || rank < 1) continue;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    out.push({ rank, amount });
  }
  out.sort((a, b) => a.rank - b.rank);
  return out;
}

// ---------- Standings ----------

export interface StandingRow {
  userId: string;
  score: number;
  rank: number;
  firstActivityAt: Date;
  // The prize this rank would receive from the tournament's prize table
  // (0 when the rank has no prize slot).
  prizeAmount: number;
}

export interface StandingsResult {
  tournamentId: string;
  startsAt: Date;
  endsAt: Date;
  minTurnover: number;
  participants: number;
  rows: StandingRow[];
}

// Aggregate WingoBet.betAmount per user over [startsAt, endsAt), keep
// only scores > 0 that meet minTurnover, then assign deterministic
// strict ranks. Pure read: never writes. Because the window upper bound
// is exclusive and settlement only runs once endsAt has passed, the
// result is naturally frozen at settlement time.
export async function computeStandings(tournament: {
  id: string;
  startsAt: Date;
  endsAt: Date;
  minTurnover: Prisma.Decimal | number | string;
  prizes: Prisma.JsonValue | null;
}): Promise<StandingsResult> {
  const minTurnover = dec(tournament.minTurnover);
  const prizes = parsePrizes(tournament.prizes);
  const prizeByRank = new Map<number, number>(prizes.map((p) => [p.rank, p.amount]));

  const grouped = await db.wingoBet.groupBy({
    by: ['userId'],
    where: {
      createdAt: { gte: tournament.startsAt, lt: tournament.endsAt },
      status: { in: WAGER_STATUSES },
    },
    _sum: { betAmount: true },
    _min: { createdAt: true },
  });

  const rows: StandingRow[] = [];
  for (const g of grouped) {
    const score = dec(g._sum.betAmount ?? 0);
    if (score.lte(0)) continue;
    if (minTurnover.gt(0) && score.lt(minTurnover)) continue;
    rows.push({
      userId: g.userId,
      score: Number(score),
      rank: 0,
      firstActivityAt: g._min.createdAt ?? tournament.startsAt,
      prizeAmount: 0,
    });
  }

  // Deterministic strict ranking: score desc, earliest activity asc,
  // userId asc. Compare scores as Decimals to avoid float drift.
  rows.sort((a, b) => {
    const s = dec(b.score).cmp(dec(a.score));
    if (s !== 0) return s;
    const t = a.firstActivityAt.getTime() - b.firstActivityAt.getTime();
    if (t !== 0) return t;
    return a.userId < b.userId ? -1 : a.userId > b.userId ? 1 : 0;
  });

  rows.forEach((row, i) => {
    row.rank = i + 1;
    row.prizeAmount = prizeByRank.get(row.rank) ?? 0;
  });

  return {
    tournamentId: tournament.id,
    startsAt: tournament.startsAt,
    endsAt: tournament.endsAt,
    minTurnover: Number(minTurnover),
    participants: rows.length,
    rows,
  };
}

// ---------- Settlement ----------

export interface SettlePayoutLine {
  userId: string;
  rank: number;
  score: number;
  amount: number;
  status: 'paid' | 'skipped_duplicate' | 'skipped_no_participant' | 'failed';
  payoutId?: string | null;
  error?: string;
}

export interface SettleResult {
  tournamentId: string;
  status: string;
  claimed: boolean;
  dryRun: boolean;
  participants: number;
  paidCount: number;
  totalPaid: number;
  prizeSlots: number;
  lines: SettlePayoutLine[];
}

function fmtBdt(amount: Prisma.Decimal): string {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '0';
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(2).replace(/\.?0+$/, '');
}

// A frozen payout row awaiting credit, loaded from the persisted
// TournamentPayout table (never recomputed from live standings).
interface FrozenPayout {
  id: string;
  userId: string;
  rank: number;
  score: Prisma.Decimal;
  amount: Prisma.Decimal;
}

// Credit ONE already-frozen, still-'pending' payout row exactly once.
// The guarded updateMany (where { id, status: 'pending' }) is the per-row
// exactly-once lock: only the caller whose update reports count === 1 owns
// the credit, and it runs INSIDE the same transaction as the money move,
// so a concurrent tick's identical update blocks on the row lock and then
// sees status = 'paid' (count 0), while a crash before commit rolls the
// flip back to 'pending' for the next tick to resume. Standings are never
// recomputed here; we credit exactly what was frozen at claim time.
async function creditFrozenPayoutInTx(
  tx: Tx,
  tournament: { id: string; nameEn: string; nameBn: string | null; turnoverX: Prisma.Decimal },
  payout: FrozenPayout,
): Promise<'credited' | 'already_paid'> {
  // 0. Per-row guard. Flip pending -> paid; only the winner (count === 1)
  //    proceeds to move money in this same transaction.
  const claim = await tx.tournamentPayout.updateMany({
    where: { id: payout.id, status: 'pending' },
    data: { status: 'paid' },
  });
  if (claim.count !== 1) return 'already_paid';

  const turnoverX = dec(tournament.turnoverX);
  const turnoverRequired = payout.amount.mul(turnoverX);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // 1. Credit REAL BDT into Wallet.balance (direct-balance source; the
  //    withdrawal gate enforces any turnover lock via the UserBonus row).
  await tx.wallet.upsert({
    where: { userId: payout.userId },
    update: { balance: { increment: payout.amount } },
    create: { userId: payout.userId, balance: payout.amount, bonusBalance: 0, lockedBalance: 0, currency: 'BDT' },
  });

  // 2. Optional turnover lock. Only when turnoverX > 0; a pure-cash
  //    prize (turnoverX = 0) creates no UserBonus so the funds are
  //    immediately withdrawable.
  let userBonusId: string | null = null;
  if (turnoverRequired.gt(0)) {
    const grant = await tx.userBonus.create({
      data: {
        userId: payout.userId,
        bonusRuleId: null,
        amount: payout.amount,
        expiresAt,
        status: 'active',
        turnoverRequired,
        turnoverProgress: 0,
        sourceType: 'tournament_prize',
        sourceId: payout.id,
        note: `WinGo Tournament ${tournament.nameEn} . rank ${payout.rank}`,
      },
    });
    userBonusId = grant.id;
  }

  // 3. Wallet history row. Reuses the existing 'bonus' Transaction type
  //    with meta.kind='tournament_prize' (no new enum value added).
  const walletTx = await tx.transaction.create({
    data: {
      userId: payout.userId,
      type: 'bonus',
      status: 'completed',
      amount: payout.amount,
      reference: payout.id,
      description: `Tournament prize . ${tournament.nameEn} . rank ${payout.rank}`,
      meta: {
        kind: 'tournament_prize',
        tournamentId: tournament.id,
        tournamentPayoutId: payout.id,
        rank: payout.rank,
        score: Number(payout.score),
        turnoverX: Number(turnoverX),
        turnoverRequired: Number(turnoverRequired),
      } as Prisma.JsonObject,
    },
  });

  // 4. Player-facing notification.
  const amountText = fmtBdt(payout.amount);
  const nameLine = tournament.nameBn ? `${tournament.nameEn} (${tournament.nameBn})` : tournament.nameEn;
  const notification = await tx.notification.create({
    data: {
      titleEn: `Congratulations! You finished rank ${payout.rank} and won ${amountText} BDT`,
      titleBn: `অভিনন্দন! আপনি ${payout.rank} নম্বরে থেকে ${amountText} BDT জিতেছেন`,
      bodyEn: `You placed rank ${payout.rank} in the "${tournament.nameEn}" WinGo tournament. The prize is credited to your balance${turnoverX.gt(0) ? ` with a ${turnoverX}x turnover lock` : ''}.`,
      bodyBn: `"${nameLine}" WinGo টুর্নামেন্টে আপনি ${payout.rank} নম্বরে ছিলেন। পুরস্কার আপনার ব্যালেন্সে যোগ হয়েছে${turnoverX.gt(0) ? `, ${turnoverX}x টার্নওভার শর্তসহ` : ''}।`,
      linkUrl: '/leaderboard',
      priority: 'high',
      status: 'sent',
      audience: 'selected',
      kind: 'tournament',
    },
  });
  await tx.notificationRecipient.create({
    data: { notificationId: notification.id, userId: payout.userId, deliveredAt: new Date() },
  });

  // 5. Wire the payout back to its wallet tx + bonus grant for the audit
  //    view.
  await tx.tournamentPayout.update({
    where: { id: payout.id },
    data: { walletTxId: walletTx.id, userBonusId },
  });

  return 'credited';
}

type SettleTournamentRow = {
  id: string;
  nameEn: string;
  nameBn: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  minTurnover: Prisma.Decimal;
  turnoverX: Prisma.Decimal;
  prizes: Prisma.JsonValue | null;
};

// FREEZE step. The single caller that wins the guarded ended -> settling
// transition computes standings ONCE and persists the winning ranks as
// 'pending' TournamentPayout rows, all inside ONE transaction. Because the
// status flip and the row inserts commit together, a crash before commit
// leaves the tournament 'ended' for the next tick to re-claim cleanly (no
// half-frozen state). After this returns claimed=true the standings are
// frozen forever; nothing downstream recomputes them.
//
// Returns claimed=false when this caller did not win the transition (the
// tournament was already 'settling'/'paid' or no longer 'ended'); the
// caller then simply runs the credit pass to resume.
async function freezeStandingsIfClaimed(tournament: SettleTournamentRow): Promise<{ claimed: boolean }> {
  const prizes = parsePrizes(tournament.prizes);

  // Compute standings BEFORE opening the transaction. The [startsAt, endsAt)
  // window is closed and immutable at settle time, so the aggregation is
  // deterministic: two racing callers compute identical standings and only
  // the count === 1 winner below persists rows. Keeping the (potentially
  // large) groupBy out of the transaction means it can never hold the
  // Tournament row lock or exceed the interactive-transaction timeout and
  // strand the tournament in 'ended'.
  const standings = await computeStandings(tournament);
  const standingByRank = new Map<number, StandingRow>(standings.rows.map((r) => [r.rank, r]));

  return db.$transaction(async (tx) => {
    const claim = await tx.tournament.updateMany({
      where: { id: tournament.id, status: 'ended' },
      data: { status: 'settling', settledAt: new Date() },
    });
    if (claim.count !== 1) return { claimed: false };

    for (const prize of prizes) {
      const winner = standingByRank.get(prize.rank);
      // Fewer participants than prize slots: never invent a winner, so no
      // row is frozen for an unclaimed rank.
      if (!winner) continue;
      await tx.tournamentPayout.create({
        data: {
          tournamentId: tournament.id,
          userId: winner.userId,
          rank: prize.rank,
          score: dec(winner.score),
          amount: dec(prize.amount),
          status: 'pending',
          idempotencyKey: `${tournament.id}:${winner.userId}`,
        },
      });
    }

    return { claimed: true };
  });
}

// CREDIT step. Loads the persisted 'pending' payout rows and credits each
// exactly once (creditFrozenPayoutInTx holds the per-row guard). Fully
// idempotent: already-'paid' rows are simply absent from the pending set,
// and a row another tick is mid-crediting is skipped via the count===1
// guard. When no 'pending' rows remain the tournament flips settling ->
// paid (guarded, so it only fires from the settling state). Never
// recomputes standings.
async function creditPendingPayouts(tournament: SettleTournamentRow): Promise<{
  lines: SettlePayoutLine[];
  paidCount: number;
  totalPaid: Prisma.Decimal;
}> {
  const pending = await db.tournamentPayout.findMany({
    where: { tournamentId: tournament.id, status: 'pending' },
    orderBy: { rank: 'asc' },
  });

  const lines: SettlePayoutLine[] = [];
  let paidCount = 0;
  let totalPaid = dec(0);

  for (const row of pending) {
    const amount = dec(row.amount);
    try {
      const outcome = await db.$transaction((tx) =>
        creditFrozenPayoutInTx(
          tx,
          { id: tournament.id, nameEn: tournament.nameEn, nameBn: tournament.nameBn, turnoverX: dec(tournament.turnoverX) },
          { id: row.id, userId: row.userId, rank: row.rank, score: dec(row.score), amount },
        ),
      );
      if (outcome === 'credited') {
        paidCount += 1;
        totalPaid = totalPaid.add(amount);
        lines.push({ userId: row.userId, rank: row.rank, score: Number(row.score), amount: Number(amount), status: 'paid', payoutId: row.id });
      } else {
        // Concurrent tick already credited this row. Idempotent no-op.
        lines.push({ userId: row.userId, rank: row.rank, score: Number(row.score), amount: Number(amount), status: 'skipped_duplicate', payoutId: row.id });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'unknown';
      console.error('[tournaments/engine] payout credit failed', { tournamentId: tournament.id, rank: row.rank }, err);
      lines.push({ userId: row.userId, rank: row.rank, score: Number(row.score), amount: Number(amount), status: 'failed', payoutId: row.id, error: message });
    }
  }

  // Finalize settling -> paid only when every frozen row is credited.
  // Guarded on the 'settling' state so it fires once; a failed row leaves
  // pending rows behind and keeps the tournament in 'settling' for the
  // next tick to retry.
  const remaining = await db.tournamentPayout.count({
    where: { tournamentId: tournament.id, status: 'pending' },
  });
  if (remaining === 0) {
    await db.tournament.updateMany({
      where: { id: tournament.id, status: 'settling' },
      data: { status: 'paid' },
    });
  }

  return { lines, paidCount, totalPaid };
}

// Settle a tournament. On a real run:
//   1. FREEZE: the guarded ended -> settling transition (count === 1)
//      computes standings ONCE and persists the winning ranks as 'pending'
//      TournamentPayout rows, atomically. Standings are never recomputed
//      after this point.
//   2. CREDIT: a separate pass loads the persisted 'pending' rows and
//      credits each exactly once (per-row count===1 guard + the
//      @@unique([tournamentId, userId]) / @@unique([tournamentId, rank])
//      constraints), then flips settling -> paid when none remain.
// A crash between freeze and credit, or mid-credit, is fully recovered on
// the next tick (which re-enters at the credit pass). Concurrent ticks
// can never double-pay: one wins the freeze claim, and each frozen row is
// credited by exactly one transaction.
// A dryRun computes LIVE standings + intended prizes and credits NOTHING
// (and persists NOTHING).
export async function settleTournament(
  id: string,
  opts: { dryRun?: boolean; actorId?: string | null; actorRole?: string | null } = {},
): Promise<SettleResult> {
  const dryRun = opts.dryRun === true;
  const tournament = await db.tournament.findUnique({ where: { id } });
  if (!tournament) throw new Error('TOURNAMENT_NOT_FOUND');

  const prizes = parsePrizes(tournament.prizes);

  const result = (status: string, claimed: boolean, lines: SettlePayoutLine[], paidCount: number, totalPaid: number, participants: number): SettleResult => ({
    tournamentId: tournament.id,
    status,
    claimed,
    dryRun,
    participants,
    paidCount,
    totalPaid,
    prizeSlots: prizes.length,
    lines,
  });

  // ----- Dry run: preview only, zero writes, LIVE standings. -----
  if (dryRun) {
    const standings = await computeStandings(tournament);
    const standingByRank = new Map<number, StandingRow>(standings.rows.map((r) => [r.rank, r]));
    const lines: SettlePayoutLine[] = [];
    let total = dec(0);
    for (const prize of prizes) {
      const winner = standingByRank.get(prize.rank);
      if (!winner) {
        lines.push({ userId: '', rank: prize.rank, score: 0, amount: prize.amount, status: 'skipped_no_participant' });
        continue;
      }
      total = total.add(dec(prize.amount));
      lines.push({ userId: winner.userId, rank: prize.rank, score: winner.score, amount: prize.amount, status: 'paid', payoutId: null });
    }
    return result(tournament.status, false, lines, lines.filter((l) => l.status === 'paid').length, Number(total), standings.participants);
  }

  // ----- Real settlement. -----
  // A voided tournament never pays.
  if (tournament.status === 'void') return result('void', false, [], 0, 0, 0);
  // Not yet ready: still draft or active (the caller should markDueEnded
  // first). Never settle a live tournament.
  if (tournament.status === 'draft' || tournament.status === 'active') {
    return result(tournament.status, false, [], 0, 0, 0);
  }

  // FREEZE. Claim ended -> settling and persist the frozen pending rows.
  // claimed=false means the tournament is already settling/paid (resume)
  // or moved to a non-payable state; either way we fall through to the
  // idempotent credit pass, which is a no-op for a non-payable state.
  const { claimed } = await freezeStandingsIfClaimed(tournament);

  if (!claimed) {
    const fresh = await db.tournament.findUnique({ where: { id }, select: { status: true } });
    // Only 'settling' (freeze done, credit pending) or 'paid' (finalizing
    // a straggler row) resume the credit pass. Anything else is a no-op.
    if (!fresh || (fresh.status !== 'settling' && fresh.status !== 'paid')) {
      return result(fresh?.status ?? tournament.status, false, [], 0, 0, 0);
    }
  }

  // CREDIT. Pay each frozen pending row exactly once and finalize.
  const { lines, paidCount, totalPaid } = await creditPendingPayouts(tournament);
  const finalStatus = await db.tournament.findUnique({ where: { id }, select: { status: true } });
  return result(finalStatus?.status ?? 'settling', claimed, lines, paidCount, Number(totalPaid), lines.length);
}

// ---------- Lifecycle sweeps ----------

// Promote scheduled drafts whose window has opened. draft -> active when
// startsAt <= now < endsAt. A draft with a future startsAt stays draft
// (still editable/deletable by the admin).
export async function activateDueTournaments(now: Date = new Date()): Promise<{ activated: number }> {
  const res = await db.tournament.updateMany({
    where: { status: 'draft', startsAt: { lte: now }, endsAt: { gt: now } },
    data: { status: 'active' },
  });
  return { activated: res.count };
}

// Freeze tournaments whose window has closed. active (or a draft that was
// created entirely in the past and never activated) -> ended when
// now >= endsAt. Voided tournaments are untouched.
export async function markDueEnded(now: Date = new Date()): Promise<{ ended: number }> {
  const res = await db.tournament.updateMany({
    where: { status: { in: ['active', 'draft'] }, endsAt: { lte: now } },
    data: { status: 'ended' },
  });
  return { ended: res.count };
}

export interface TournamentTickResult {
  activated: number;
  ended: number;
  settled: number;
  settledTournaments: Array<{ id: string; paidCount: number; totalPaid: number }>;
}

// The full reconcile owned by the cron driver (and the admin settle
// action). This is the ONLY money-moving path; the public leaderboard
// read never calls it. Idempotent and safe to call every minute:
//   1. activate due drafts, end due tournaments (cheap status flips),
//   2. settle every 'ended' tournament (freeze + credit), and
//   3. RESUME every 'settling' tournament, plus any 'paid' tournament that
//      still carries 'pending' payout rows (belt-and-braces), by re-running
//      the credit pass. A process crash between freeze and credit, or
//      mid-credit, is therefore fully recovered on the next tick; the
//      per-row count===1 guard skips rows already credited.
export async function runTournamentTick(
  now: Date = new Date(),
  actor: { actorId?: string | null; actorRole?: string | null } = {},
): Promise<TournamentTickResult> {
  const { activated } = await activateDueTournaments(now);
  const { ended } = await markDueEnded(now);

  // Candidates: freshly-ended (need freeze + credit), still-settling (need
  // credit resume after a crash), and any 'paid' tournament that somehow
  // still has pending rows (a straggler that failed to credit last time).
  const [endedRows, settlingRows, paidWithPending] = await Promise.all([
    db.tournament.findMany({ where: { status: 'ended' }, select: { id: true } }),
    db.tournament.findMany({ where: { status: 'settling' }, select: { id: true } }),
    db.tournamentPayout.findMany({
      where: { status: 'pending', tournament: { status: 'paid' } },
      select: { tournamentId: true },
      distinct: ['tournamentId'],
    }),
  ]);

  const candidateIds = new Set<string>();
  for (const t of endedRows) candidateIds.add(t.id);
  for (const t of settlingRows) candidateIds.add(t.id);
  for (const p of paidWithPending) candidateIds.add(p.tournamentId);

  const settledTournaments: TournamentTickResult['settledTournaments'] = [];
  let settled = 0;
  for (const id of candidateIds) {
    try {
      const res = await settleTournament(id, { actorId: actor.actorId ?? null, actorRole: actor.actorRole ?? null });
      // Count a tournament as settled this tick when it reached 'paid' and
      // this tick actually credited at least one row (so a pure resume that
      // finds nothing left is not double-counted as fresh work).
      if (res.status === 'paid' && res.paidCount > 0) {
        settled += 1;
        settledTournaments.push({ id, paidCount: res.paidCount, totalPaid: res.totalPaid });
      }
    } catch (err) {
      console.error('[tournaments/engine] settle failed in tick', { tournamentId: id }, err);
    }
  }

  return { activated, ended, settled, settledTournaments };
}

// ---------- Public read ----------

export interface PublicTournament {
  id: string;
  nameEn: string;
  nameBn: string | null;
  status: string;
  startsAt: Date;
  endsAt: Date;
  turnoverX: number;
  minTurnover: number;
  prizes: PrizeSlot[];
  participants: number;
  // Trimmed top standings for the leaderboard (userId is masked to a
  // display handle by the API layer; the engine returns the raw rows).
  standings: StandingRow[];
  // The viewer's own row, found across the FULL standings (even when it
  // falls outside the top slice). Null when no viewer or no qualifying
  // score.
  viewer: StandingRow | null;
}

// The single active tournament for the public leaderboard, with its top
// standings. This is a READ-ONLY public path: it moves NO money and never
// settles. It performs at most a cheap, money-free lazy status flip
// (activate due drafts, end due tournaments) so the leaderboard shows the
// right subject between cron ticks; ALL settlement (freeze + credit) is
// owned by the cron driver and the admin settle action. Returns null when
// nothing is active. viewerUserId, when supplied, is resolved against the
// full standings so the signed-in player sees their own rank even beyond
// the visible slice.
export async function getActiveTournamentPublic(limit = 100, viewerUserId?: string | null): Promise<PublicTournament | null> {
  const now = new Date();
  // Cheap, money-free status flips only. No settlement, no payout,
  // no runTournamentTick.
  await activateDueTournaments(now);
  await markDueEnded(now);

  // Prefer the tournament ending soonest so a single leaderboard always
  // has a deterministic subject when more than one is active.
  const tournament = await db.tournament.findFirst({
    where: { status: 'active' },
    orderBy: { endsAt: 'asc' },
  });
  if (!tournament) return null;

  const standings = await computeStandings(tournament);
  const viewer = viewerUserId ? standings.rows.find((r) => r.userId === viewerUserId) ?? null : null;
  return {
    id: tournament.id,
    nameEn: tournament.nameEn,
    nameBn: tournament.nameBn,
    status: tournament.status,
    startsAt: tournament.startsAt,
    endsAt: tournament.endsAt,
    turnoverX: Number(tournament.turnoverX),
    minTurnover: Number(tournament.minTurnover),
    prizes: parsePrizes(tournament.prizes),
    participants: standings.participants,
    standings: standings.rows.slice(0, Math.max(1, limit)),
    viewer,
  };
}
