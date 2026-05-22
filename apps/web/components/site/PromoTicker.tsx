// Built by Anointed Coder.
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
    <div className="flex items-center gap-3 overflow-hidden rounded-card border border-neon/10 bg-base-panel/40 px-4 py-2.5">
      <span className="flex shrink-0 items-center gap-2 rounded-full border border-gold-500/30 bg-gold-500/10 px-3 py-1 text-xs text-gold-300">
        <Megaphone className="h-3.5 w-3.5" /> Live
      </span>
      <div className="mask-fade-x flex-1 overflow-hidden">
        <div className="flex w-max items-center gap-10 whitespace-nowrap animate-marquee text-sm text-ink-mid">
          {messages.map((m, i) => (
            <span key={i}>{m.message}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
