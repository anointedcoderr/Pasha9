// Built by Anointed Coder.
//
// GET /api/admin/users/[id]/wallet-audit
//
// One player's complete financial history, with the balance before and after
// every movement. This is the endpoint that answers "my balance dropped and I
// do not know why" in seconds instead of the day of hand-written SQL it took
// before the ledger existed.
//
// Defaults to the LAST 7 DAYS by client requirement: an active player
// generates hundreds of bet/win rows a day, and loading their whole history
// by default would make the page unusable for the common case. Older records
// are never discarded - they are one date filter away, back to registration.
//
// Every filter is applied server-side. Paging a thousand rows into the
// browser and filtering there is what made the old transaction log cap out
// at ~300 rows; this pages in the database so an account with tens of
// thousands of rows stays searchable.
//
// Query params:
//   from, to        ISO dates. Omit both for the last 7 days.
//   all=1           ignore the date window entirely (full history)
//   type            ledger type, e.g. provider.bet
//   direction       credit | debit
//   provider, gameUid, roundId, referenceId, transactionId
//   minAmount, maxAmount
//   actorId         movements performed by a specific staff member
//   take, skip      paging (take capped at 200)

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { reconcileUserWallet } from '@/lib/wallet/reconcile';

const DEFAULT_WINDOW_DAYS = 7;

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const user = await db.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        username: true,
        phone: true,
        createdAt: true,
        wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true } },
      },
    });
    if (!user) return jsonError(404, 'NOT_FOUND', 'User not found.');

    const q = req.nextUrl.searchParams;
    const all = q.get('all') === '1';
    const from = parseDate(q.get('from'));
    const to = parseDate(q.get('to'));

    // Window resolution: explicit dates win, then 'all', then the 7-day default.
    let dateFilter: Prisma.WalletLedgerWhereInput = {};
    if (from || to) {
      dateFilter = { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } };
    } else if (!all) {
      const since = new Date(Date.now() - DEFAULT_WINDOW_DAYS * 86_400_000);
      dateFilter = { createdAt: { gte: since } };
    }

    const minAmount = q.get('minAmount');
    const maxAmount = q.get('maxAmount');
    const amountFilter: Prisma.WalletLedgerWhereInput = (minAmount || maxAmount)
      ? {
          amount: {
            ...(minAmount ? { gte: new Prisma.Decimal(minAmount) } : {}),
            ...(maxAmount ? { lte: new Prisma.Decimal(maxAmount) } : {}),
          },
        }
      : {};

    const where: Prisma.WalletLedgerWhereInput = {
      userId: user.id,
      ...dateFilter,
      ...amountFilter,
      ...(q.get('type') ? { type: q.get('type')! } : {}),
      ...(q.get('direction') ? { direction: q.get('direction')! } : {}),
      ...(q.get('provider') ? { providerName: { contains: q.get('provider')!, mode: 'insensitive' } } : {}),
      ...(q.get('gameUid') ? { gameUid: q.get('gameUid')! } : {}),
      ...(q.get('roundId') ? { roundId: q.get('roundId')! } : {}),
      ...(q.get('referenceId') ? { referenceId: q.get('referenceId')! } : {}),
      ...(q.get('transactionId') ? { transactionId: q.get('transactionId')! } : {}),
      ...(q.get('actorId') ? { actorId: q.get('actorId')! } : {}),
    };

    const take = Math.min(200, Math.max(1, Number(q.get('take') ?? 50)));
    const skip = Math.max(0, Number(q.get('skip') ?? 0));

    // Summary totals are deliberately computed over the player's WHOLE
    // history, not the filtered window: an operator investigating a
    // complaint needs lifetime deposits vs withdrawals to judge it, and a
    // total that silently changed with the date filter would mislead.
    const [entries, total, byType, reconciliation] = await Promise.all([
      db.walletLedger.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take,
        skip,
        include: { actor: { select: { username: true } } },
      }),
      db.walletLedger.count({ where }),
      db.walletLedger.groupBy({
        by: ['type'],
        where: { userId: user.id },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      reconcileUserWallet(user.id),
    ]);

    const sumFor = (...types: string[]) =>
      byType
        .filter((r) => types.includes(r.type))
        .reduce((acc, r) => acc.add(new Prisma.Decimal(r._sum.amount ?? 0)), new Prisma.Decimal(0))
        .toFixed(2);

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        registeredAt: user.createdAt,
      },
      wallet: {
        balance: Number(user.wallet?.balance ?? 0),
        bonusBalance: Number(user.wallet?.bonusBalance ?? 0),
        lockedBalance: Number(user.wallet?.lockedBalance ?? 0),
        lottoBalance: Number(user.wallet?.lottoBalance ?? 0),
      },
      summary: {
        totalDeposits: sumFor('deposit'),
        totalWithdrawals: sumFor('withdrawal'),
        totalBets: sumFor('provider.bet', 'native.bet'),
        totalWins: sumFor('provider.win', 'native.win'),
        totalBonuses: sumFor('bonus.grant', 'bonus.release', 'cashback', 'spin.reward', 'betting_pass.reward', 'promo_code.reward', 'referral.reward', 'affiliate.commission', 'vip.reward', 'lotto.prize', 'tournament.prize'),
        totalAdminCredits: sumFor('admin.credit'),
        totalAdminDebits: sumFor('admin.debit'),
      },
      // Surfaced rather than hidden: if the recorded history does not account
      // for the wallet, the operator must know before quoting these figures
      // to a player.
      reconciliation,
      paging: { take, skip, total, returned: entries.length },
      windowDays: from || to || all ? null : DEFAULT_WINDOW_DAYS,
      entries: entries.map((e) => ({
        id: e.id,
        at: e.createdAt,
        type: e.type,
        direction: e.direction,
        amount: Number(e.amount),
        balanceBefore: Number(e.balanceBefore),
        balanceAfter: Number(e.balanceAfter),
        status: e.status,
        provider: e.providerName,
        gameUid: e.gameUid,
        gameName: e.gameName,
        roundId: e.roundId,
        betId: e.betId,
        referenceId: e.referenceId,
        transactionId: e.transactionId,
        bonusSource: e.bonusSource,
        description: e.description,
        actor: e.actor?.username ?? null,
        actorRole: e.actorRole,
        reversesId: e.reversesId,
      })),
    });
  });
}
