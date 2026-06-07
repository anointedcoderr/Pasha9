// Built by Anointed Coder.
//
// GET /api/admin/referral-claims
//
// Admin overview of the referral claim ledger. Returns the cached
// ReferralBalance rows joined with the user (newest activity first),
// the current cadence settings, and the recent ReferralClaim rows
// (last 100). Filter by status / username / phone / email via the
// `q` and `status` query params.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';
import { loadReferralSettings } from '@/lib/affiliate/balance';

const ALLOWED_STATUSES = new Set(['pending', 'paid', 'rejected']);

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('users.read');

    const url = new URL(req.url);
    const q = (url.searchParams.get('q') ?? '').trim();
    const statusParam = (url.searchParams.get('status') ?? '').trim();
    const status = ALLOWED_STATUSES.has(statusParam) ? statusParam : null;

    const settings = await loadReferralSettings();

    const userFilter = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { phone: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : undefined;

    const balances = await db.referralBalance.findMany({
      where: userFilter ? { user: userFilter } : {},
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
      include: {
        user: { select: { username: true, phone: true, email: true } },
      },
    });

    const claims = await db.referralClaim.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(userFilter ? { user: userFilter } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { username: true, phone: true } },
      },
    });

    return jsonOk({
      settings,
      balances: balances.map((b) => ({
        userId: b.userId,
        username: b.user.username,
        phone: b.user.phone,
        email: b.user.email,
        pendingAmount: Number(b.pendingAmount),
        claimableAmount: Number(b.claimableAmount),
        claimedAmount: Number(b.claimedAmount),
        lastClaimedAt: b.lastClaimedAt,
        updatedAt: b.updatedAt,
      })),
      claims: claims.map((c) => ({
        id: c.id,
        userId: c.userId,
        username: c.user.username,
        phone: c.user.phone,
        amount: Number(c.amount),
        status: c.status,
        errorCode: c.errorCode,
        walletTxId: c.walletTxId,
        payoutId: c.payoutId,
        createdAt: c.createdAt,
        paidAt: c.paidAt,
      })),
    });
  });
}
