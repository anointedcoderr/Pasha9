// Built by Anointed Coder.
//
// POST /api/admin/users/[id]/balance
//
// Operator-side wallet adjustment. Body: { amount, reason, type? }.
//   amount  signed Decimal in BDT. Positive credits the wallet, negative
//           debits it.
//   reason  short free-text logged permanently so audit can trace why.
//   type    optional override of the Transaction.type. Defaults to
//           'adjust'. Restricted to a small allow-list.
//
// TWO DIFFERENT PEOPLE CAN CALL THIS, WITH DIFFERENT RULES. This split is a
// client security requirement, not a style choice - a staff member with
// Balance Management access must never have the same reach into player
// wallets that a super_admin has.
//
//   super_admin - unrestricted. Can credit or debit, no point cost, no
//     forced turnover (they can set turnover manually if they want it).
//     Exactly today's behaviour, unchanged.
//
//   staff / admin - can only CREDIT. A negative amount is rejected outright,
//     regardless of what permission they hold; only a super_admin can ever
//     reduce a player's balance. Every credit spends 1:1 from their
//     StaffPointWallet (see lib/staff/points.ts) - insufficient points
//     blocks the credit before anything touches the player. And every
//     credit automatically creates a turnover requirement on the player,
//     sized by the staff_balance_turnover_x setting a super_admin controls;
//     staff has no way to set, skip, or shrink that requirement themselves.
//
// One atomic transaction: wallet update + ledger + staff point spend +
// (for staff) the turnover grant, so a credit can never half-land.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { jsonError, jsonOk } from '@/lib/auth/errors';
import { applyWalletMovement, LEDGER_TYPE } from '@/lib/wallet/ledger';
import { applyStaffPointMovement, loadStaffPointBalance, STAFF_POINT_TYPE } from '@/lib/staff/points';

const schema = z.object({
  amount: z.coerce.number().refine((v) => Number.isFinite(v) && v !== 0, 'Amount must be non-zero'),
  reason: z.string().trim().min(3, 'Reason must be at least 3 characters.').max(240),
  type: z.enum(['adjust', 'bonus', 'referral']).optional().default('adjust'),
});

const STAFF_BALANCE_TURNOVER_KEY = 'staff_balance_turnover_x';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.balance.adjust');
    const isSuperAdmin = session.role === 'super_admin';

    const body = await req.json().catch(() => ({}));
    const parsed = schema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    const amount = parsed.data.amount;

    // Staff/admin can only add money. Checked before anything else touches
    // the database: rejecting here means a staff member cannot even learn
    // whether a debit "would have" succeeded.
    if (!isSuperAdmin && amount < 0) {
      return jsonError(403, 'DEBIT_FORBIDDEN', 'Only a Super Admin can reduce a player\'s balance.');
    }

    const [target, actor] = await Promise.all([
      db.user.findUnique({
        where: { id: params.id },
        select: { id: true, username: true, wallet: { select: { balance: true } } },
      }),
      db.user.findUnique({ where: { id: session.sub }, select: { username: true } }),
    ]);
    if (!target) return jsonError(404, 'NOT_FOUND', 'User not found.');

    const before = Number(target.wallet?.balance ?? 0);
    const after = before + amount;
    if (after < 0) {
      return jsonError(409, 'INSUFFICIENT_BALANCE', `Debit of ${Math.abs(amount)} BDT would push balance below zero (current ${before}).`);
    }

    // Staff spends from their own point pool before anything else happens,
    // so an under-funded staff member gets a clear, specific error rather
    // than a generic failure after a partial write.
    let pointsBefore: Prisma.Decimal | null = null;
    let pointsAfter: Prisma.Decimal | null = null;
    if (!isSuperAdmin) {
      pointsBefore = await loadStaffPointBalance(db, session.sub);
      if (pointsBefore.lt(amount)) {
        return jsonError(
          409,
          'INSUFFICIENT_STAFF_POINTS',
          `You have ${pointsBefore.toFixed(2)} points remaining, not enough to credit ${amount.toFixed(2)}. Ask a Super Admin for more.`,
        );
      }
    }

    // Turnover multiplier for staff-originated credits. Per-staff value wins
    // when a Super Admin has set one on that staff member's point wallet;
    // otherwise the global staff_balance_turnover_x applies. Null (never
    // configured) is deliberately distinct from 0 (configured as "no
    // turnover"), so an explicit 0 on one staff member is honoured rather
    // than silently falling back to the global figure.
    let staffTurnoverX = 0;
    if (!isSuperAdmin) {
      const perStaff = await db.staffPointWallet.findUnique({
        where: { staffId: session.sub },
        select: { turnoverMultiplier: true },
      });
      if (perStaff?.turnoverMultiplier != null) {
        staffTurnoverX = Math.max(0, Number(perStaff.turnoverMultiplier) || 0);
      } else {
        const row = await db.systemSetting.findUnique({ where: { key: STAFF_BALANCE_TURNOVER_KEY }, select: { value: true } });
        staffTurnoverX = Math.max(0, Number(row?.value ?? 0) || 0);
      }
    }

    const result = await db.$transaction(async (tx) => {
      const txRow = await tx.transaction.create({
        data: {
          userId: params.id,
          type: parsed.data.type,
          amount: new Prisma.Decimal(amount),
          status: 'completed',
          description: parsed.data.reason,
          meta: {
            adjustedBy: session.sub,
            balanceBefore: before,
            balanceAfter: after,
          } as Prisma.JsonObject,
        },
      });

      // Routed through the central wallet service rather than updating the
      // balance here: it applies the movement and writes the permanent ledger
      // entry in this same transaction, so a manual operator adjustment can
      // never move money without recording who did it, why, and the balance
      // either side of it.
      const ledger = await applyWalletMovement({
        tx,
        userId: params.id,
        amount: new Prisma.Decimal(amount),
        type: isSuperAdmin ? (amount > 0 ? LEDGER_TYPE.adminCredit : LEDGER_TYPE.adminDebit) : LEDGER_TYPE.staffCredit,
        description: parsed.data.reason,
        transactionId: txRow.id,
        referenceId: txRow.id,
        actorId: session.sub,
        actorRole: session.role,
        meta: { adjustmentType: parsed.data.type } as Prisma.JsonObject,
      });

      let points: { before: Prisma.Decimal; after: Prisma.Decimal } | null = null;
      let turnoverGrantId: string | null = null;
      let turnoverRequired: Prisma.Decimal | null = null;

      if (!isSuperAdmin) {
        const spend = await applyStaffPointMovement({
          tx,
          staffId: session.sub,
          amount: new Prisma.Decimal(amount).neg(),
          type: STAFF_POINT_TYPE.spend,
          actorId: session.sub,
          actorRole: session.role,
          targetUserId: params.id,
          reason: parsed.data.reason,
          meta: { walletLedgerId: ledger.id, transactionId: txRow.id } as Prisma.JsonObject,
        });
        points = { before: spend.before, after: spend.after };

        if (staffTurnoverX > 0) {
          turnoverRequired = new Prisma.Decimal(amount).mul(staffTurnoverX);
          const grant = await tx.userBonus.create({
            data: {
              userId: params.id,
              bonusRuleId: null,
              amount: new Prisma.Decimal(amount),
              status: 'active',
              turnoverRequired,
              turnoverProgress: 0,
              sourceType: 'staff_balance_add',
              sourceId: ledger.id,
              note: `Turnover requirement from a staff balance credit (${staffTurnoverX}x). Credited by ${actor?.username ?? session.sub}.`,
            },
            select: { id: true },
          });
          turnoverGrantId = grant.id;
        }
      }

      return { transactionId: txRow.id, ledgerId: ledger.id, before, after, points, turnoverGrantId, turnoverRequired };
    });

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: isSuperAdmin ? (amount > 0 ? 'BALANCE_CREDIT' : 'BALANCE_DEBIT') : 'STAFF_BALANCE_CREDIT',
      target: params.id,
      detail: parsed.data.reason.slice(0, 240),
      meta: {
        staffId: session.sub,
        staffUsername: actor?.username ?? null,
        playerId: params.id,
        playerUsername: target.username,
        amount,
        balanceBefore: result.before,
        balanceAfter: result.after,
        transactionId: result.transactionId,
        // Only present for a staff-originated credit; null for super_admin.
        staffPointsBefore: result.points ? Number(result.points.before) : null,
        staffPointsAfter: result.points ? Number(result.points.after) : null,
        turnoverCreated: result.turnoverRequired ? Number(result.turnoverRequired) : null,
        turnoverGrantId: result.turnoverGrantId,
      },
    });

    return jsonOk({
      ok: true,
      transactionId: result.transactionId,
      balance: { before: result.before, after: result.after },
      staffPoints: result.points ? { before: Number(result.points.before), after: Number(result.points.after) } : null,
      turnoverCreated: result.turnoverRequired ? Number(result.turnoverRequired) : null,
    });
  });
}
