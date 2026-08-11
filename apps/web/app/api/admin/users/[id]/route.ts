// Built by Anointed Coder.
//
// Per-user detail for the admin user details drawer. Returns the full
// profile, wallet, role, referred-by snapshot, and lifetime deposit /
// withdrawal aggregates so support can review an account in one
// glance.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission, recordActivity } from '@/lib/auth/guard';
import { revokePriorSessionsForUser } from '@/lib/auth/session';
import { jsonError, jsonOk } from '@/lib/auth/errors';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    await ensurePermission('users.read');
    const user = await db.user.findUnique({
      where: { id: params.id },
      include: {
        role: { select: { key: true, label: true } },
        wallet: { select: { balance: true, bonusBalance: true, lockedBalance: true, lottoBalance: true, currency: true } },
        referredBy: { select: { id: true, username: true, referralCode: true } },
      },
    });
    if (!user) return jsonError(404, 'NOT_FOUND');

    const [depositSum, withdrawSum, depositsApprovedCount, withdrawalsApprovedCount, lotteryTickets, lotteryWinnings, lastLoginCount] =
      await Promise.all([
        db.deposit.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
        db.withdrawal.aggregate({ where: { userId: user.id, status: 'approved' }, _sum: { amount: true } }),
        db.deposit.count({ where: { userId: user.id, status: 'approved' } }),
        db.withdrawal.count({ where: { userId: user.id, status: 'approved' } }),
        db.lotteryTicket.count({ where: { userId: user.id } }),
        db.lotteryWinning.count({ where: { userId: user.id } }),
        db.session.count({ where: { userId: user.id } }),
      ]);

    return jsonOk({
      user: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        blockedReason: user.blockedReason,
        blockedAt: user.blockedAt,
        country: user.country,
        language: user.language,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        isAffiliate: user.isAffiliate,
        lastLoginAt: user.lastLoginAt,
        lastLoginIp: user.lastLoginIp,
        phoneVerifiedAt: user.phoneVerifiedAt,
        createdAt: user.createdAt,
        wallet: {
          balance: Number(user.wallet?.balance ?? 0),
          bonusBalance: Number(user.wallet?.bonusBalance ?? 0),
          lockedBalance: Number(user.wallet?.lockedBalance ?? 0),
          lottoBalance: Number(user.wallet?.lottoBalance ?? 0),
          currency: user.wallet?.currency ?? 'BDT',
        },
        totals: {
          deposit: Number(depositSum._sum.amount ?? 0),
          withdraw: Number(withdrawSum._sum.amount ?? 0),
          depositsApprovedCount,
          withdrawalsApprovedCount,
          lotteryTickets,
          lotteryWinnings,
          sessionCount: lastLoginCount,
        },
      },
    });
  });
}

const patchSchema = z.object({
  status: z.enum(['active', 'blocked', 'pending']).optional(),
  blockedReason: z.string().trim().max(240).optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(async () => {
    const session = await ensurePermission('users.update');
    const body = await req.json().catch(() => ({}));
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return jsonError(400, 'VALIDATION', undefined, { issues: parsed.error.issues });

    // Suspending, blocking or reinstating a player is a super_admin-only
    // power, even for a staff member holding users.update - the client's
    // explicit requirement, because a staff account misusing User Management
    // could otherwise disable or reactivate any player at will. Both
    // directions of the toggle are covered: reversing someone else's block
    // is the same power as applying one. blockedReason alone (editing the
    // note on an existing block, not the status itself) is left open, since
    // it changes nothing about who can access the platform.
    if (parsed.data.status !== undefined && session.role !== 'super_admin') {
      return jsonError(403, 'SUPER_ADMIN_ONLY', 'Only a Super Admin can suspend, block, or reinstate a player account.');
    }

    // Read the prior status before writing, so the log can show what changed
    // it changed FROM, not only what it is now. A staff member reviewing why
    // a player was blocked needs to know they were active before, not just
    // that they are blocked today.
    const before = await db.user.findUnique({ where: { id: params.id }, select: { status: true } });

    // Status flip drives whether we set or clear blockedReason / blockedAt.
    const nextStatus = parsed.data.status;
    const data: {
      status?: 'active' | 'blocked' | 'pending';
      blockedReason?: string | null;
      blockedAt?: Date | null;
    } = {};
    if (nextStatus) data.status = nextStatus;
    if (nextStatus === 'blocked') {
      data.blockedReason = parsed.data.blockedReason?.trim() || null;
      data.blockedAt = new Date();
    } else if (nextStatus === 'active' || nextStatus === 'pending') {
      data.blockedReason = null;
      data.blockedAt = null;
    }

    const updated = await db.user.update({
      where: { id: params.id },
      data,
      select: { id: true, status: true, username: true, blockedReason: true, blockedAt: true },
    });

    // When blocking, immediately revoke every active session row for
    // the user so their refresh cookie cannot mint new access tokens.
    if (nextStatus === 'blocked') {
      await revokePriorSessionsForUser(params.id);
    }

    await recordActivity({
      actorId: session.sub,
      actorRole: session.role,
      action: nextStatus === 'blocked' ? 'USER_BLOCK' : nextStatus === 'active' ? 'USER_UNBLOCK' : 'USER_UPDATE',
      target: updated.id,
      detail: nextStatus ? `${before?.status ?? 'unknown'} -> ${nextStatus}` : undefined,
      meta: nextStatus
        ? { statusBefore: before?.status ?? null, statusAfter: nextStatus, reason: data.blockedReason ?? undefined }
        : undefined,
    });

    return jsonOk({ user: updated });
  });
}
