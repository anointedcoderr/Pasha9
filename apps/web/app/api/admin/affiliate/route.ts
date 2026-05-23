// Built by Anointed Coder.

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { db } from '@/lib/db/client';
import { withAuth, ensurePermission } from '@/lib/auth/guard';
import { jsonOk } from '@/lib/auth/errors';

export async function GET(req: NextRequest) {
  return withAuth(async () => {
    await ensurePermission('affiliate.read');
    const status = req.nextUrl.searchParams.get('status'); // pending, approved, rejected, all
    const q = req.nextUrl.searchParams.get('q')?.trim() ?? '';
    const take = Math.min(200, Number(req.nextUrl.searchParams.get('take') ?? 50));

    const where: Record<string, unknown> = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    if (q) {
      where.user = {
        OR: [
          { username: { contains: q, mode: 'insensitive' as const } },
          { phone: { contains: q } },
          { referralCode: { contains: q, mode: 'insensitive' as const } },
        ],
      };
    }

    const applications = await db.affiliateApplication.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            phone: true,
            referralCode: true,
            isAffiliate: true,
            createdAt: true,
            affiliateTier: { select: { id: true, name: true } },
            _count: { select: { referrals: true } },
          },
        },
      },
    });

    // Also pull users marked isAffiliate that may not have an application row
    // (e.g. manually promoted by super admin). Include them as synthetic rows
    // so the admin sees every affiliate, not just applicants.
    const flagged = await db.user.findMany({
      where: {
        isAffiliate: true,
        affiliateApplication: { is: null },
        ...(q
          ? {
              OR: [
                { username: { contains: q, mode: 'insensitive' as const } },
                { phone: { contains: q } },
                { referralCode: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      take: 50,
      select: {
        id: true,
        username: true,
        phone: true,
        referralCode: true,
        isAffiliate: true,
        createdAt: true,
        affiliateTier: { select: { id: true, name: true } },
        _count: { select: { referrals: true } },
      },
    });

    const synthetic = flagged.map((u) => ({
      id: `synthetic-${u.id}`,
      status: 'approved' as const,
      channel: null,
      audience: null,
      notes: null,
      reviewedAt: null,
      createdAt: u.createdAt,
      updatedAt: u.createdAt,
      user: u,
    }));

    return jsonOk({ applications: [...applications, ...synthetic] });
  });
}
