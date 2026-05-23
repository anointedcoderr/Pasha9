// Built by Anointed Coder.
// Marquee strip pulling active promo text from /api/content/promo-text.
// Light-theme version for the redesigned homepage.

'use client';

import { useEffect, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { mockPromoTexts } from '@/lib/mock/banners';

interface PromoItem { message: string }

export function PromoTicker() {
  const [items, setItems] = useState<PromoItem[]>(
    mockPromoTexts.filter((p) => p.status === 'active').map((p) => ({ message: p.message })),
  );

  useEffect(() => {
    let alive = true;
    fetch('/api/content/promo-text')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const next: PromoItem[] = (data.items ?? []).map((i: { message: string }) => ({ message: i.message }));
        if (next.length) setItems(next);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const messages = [...items, ...items];

  return (
    <div className="flex items-center gap-3 overflow-hidden rounded-xl border border-brand-divider bg-brand-paper px-3 py-2">
      <span className="flex shrink-0 items-center gap-2 rounded-full bg-brand-yellow-500/15 px-2.5 py-1 text-[11px] font-semibold text-brand-yellow-700">
        <Megaphone className="h-3.5 w-3.5" /> Live
      </span>
      <div className="mask-fade-x flex-1 overflow-hidden">
        <div className="flex w-max items-center gap-10 whitespace-nowrap animate-marquee text-sm text-brand-inkSoft">
          {messages.map((m, i) => (
            <span key={i}>{m.message}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
