// Built by Anointed Coder.
//
// GET /api/content/about-display
//
// Public read for the Phase G about / sponsorship / public-payment-
// method blocks. Returns the three PublicSection rows wrapped around
// their active items. The Footer (and any other public surface) calls
// this once on mount.
//
// Behaviour:
//   - If a PublicSection.isVisible is false, the block is hidden by
//     not returning its items. The section title still ships so the
//     UI can hide the heading too.
//   - Inactive (BrandAmbassador.isActive=false, Sponsor.isActive=false,
//     PublicPaymentMethod.isActive=false) rows are filtered out.
//   - Any internal failure returns an empty payload with HTTP 200 so
//     the page never blanks out on a transient DB hiccup.

export const dynamic = 'force-dynamic';
export const revalidate = 30;

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

interface SectionShape {
  key: string;
  isVisible: boolean;
  titleEn: string;
  titleBn: string | null;
  subtitleEn: string | null;
  subtitleBn: string | null;
  position: number;
}

const SECTION_KEYS = ['about_ambassadors', 'about_sponsors', 'public_payment_methods'] as const;

export async function GET() {
  try {
    const [sectionRows, ambassadors, sponsors, paymentMethods] = await Promise.all([
      db.publicSection.findMany({ where: { key: { in: SECTION_KEYS as unknown as string[] } } }),
      db.brandAmbassador.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
      db.sponsor.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
      db.publicPaymentMethod.findMany({
        where: { isActive: true },
        orderBy: [{ position: 'asc' }, { updatedAt: 'desc' }],
      }),
    ]);

    const byKey = new Map<string, SectionShape>();
    for (const s of sectionRows) {
      byKey.set(s.key, {
        key: s.key,
        isVisible: s.isVisible,
        titleEn: s.titleEn,
        titleBn: s.titleBn,
        subtitleEn: s.subtitleEn,
        subtitleBn: s.subtitleBn,
        position: s.position,
      });
    }

    return NextResponse.json({
      ok: true,
      sections: {
        ambassadors: byKey.get('about_ambassadors') ?? null,
        sponsors: byKey.get('about_sponsors') ?? null,
        paymentMethods: byKey.get('public_payment_methods') ?? null,
      },
      ambassadors: (byKey.get('about_ambassadors')?.isVisible ?? true)
        ? ambassadors.map((a) => ({
            id: a.id,
            nameEn: a.nameEn,
            nameBn: a.nameBn,
            iconUrl: a.iconUrl,
            subtitle: a.subtitle,
            position: a.position,
          }))
        : [],
      sponsors: (byKey.get('about_sponsors')?.isVisible ?? true)
        ? sponsors.map((s) => ({
            id: s.id,
            nameEn: s.nameEn,
            nameBn: s.nameBn,
            iconUrl: s.iconUrl,
            subtitle: s.subtitle,
            position: s.position,
          }))
        : [],
      paymentMethods: (byKey.get('public_payment_methods')?.isVisible ?? true)
        ? paymentMethods.map((p) => ({
            id: p.id,
            buttonText: p.buttonText,
            iconUrl: p.iconUrl,
            position: p.position,
          }))
        : [],
    });
  } catch (err) {
    console.error('[content/about-display] failed', err);
    return NextResponse.json({
      ok: true,
      sections: { ambassadors: null, sponsors: null, paymentMethods: null },
      ambassadors: [],
      sponsors: [],
      paymentMethods: [],
    });
  }
}
