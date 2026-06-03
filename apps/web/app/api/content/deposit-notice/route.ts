// Built by Anointed Coder.
//
// GET /api/content/deposit-notice
//
// Public read of the pre-deposit notice popup. Returns an empty list
// when the global `deposit_notice_enabled` setting is false OR when no
// enabled DepositNotice rows exist. The deposit page reads this and
// renders a modal the player must acknowledge before submitting.

export const dynamic = 'force-dynamic';
export const revalidate = 30;

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

export async function GET() {
  try {
    const flag = await db.systemSetting.findUnique({ where: { key: 'deposit_notice_enabled' } });
    const enabled = (flag?.value ?? 'false').toLowerCase() === 'true';

    if (!enabled) {
      return NextResponse.json({ ok: true, enabled: false, notices: [] });
    }

    const notices = await db.depositNotice.findMany({
      where: { isEnabled: true },
      orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
    });

    return NextResponse.json({
      ok: true,
      enabled: true,
      notices: notices.map((n) => ({
        id: n.id,
        titleEn: n.titleEn,
        titleBn: n.titleBn,
        bodyEn: n.bodyEn,
        bodyBn: n.bodyBn,
        ctaLabelEn: n.ctaLabelEn,
        ctaLabelBn: n.ctaLabelBn,
        position: n.position,
      })),
    });
  } catch (err) {
    console.error('[content/deposit-notice] load failed', err);
    return NextResponse.json({ ok: true, enabled: false, notices: [] });
  }
}
