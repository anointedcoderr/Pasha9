// Built by Anointed Coder.
//
// Live countdown timer to the next lotto draw. Pure client-side
// computation off a server-supplied ISO timestamp - no polling, no
// extra data fetched. When the time elapses the timer locks at
// 00:00:00 and the surrounding page can show a "Drawing now" state.

'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n/context';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Props {
  /** ISO string for the next draw time. */
  drawsAt: string | null | undefined;
  /** Optional compact mode for tight layouts. */
  compact?: boolean;
}

interface Parts { d: number; h: number; m: number; s: number; expired: boolean }

function diff(target: number): Parts {
  const now = Date.now();
  let delta = Math.max(0, target - now);
  const expired = delta <= 0;
  const d = Math.floor(delta / 86_400_000); delta -= d * 86_400_000;
  const h = Math.floor(delta / 3_600_000);  delta -= h * 3_600_000;
  const m = Math.floor(delta / 60_000);     delta -= m * 60_000;
  const s = Math.floor(delta / 1_000);
  return { d, h, m, s, expired };
}

export function LottoCountdown({ drawsAt, compact = false }: Props) {
  const { lang } = useLang();
  const target = drawsAt ? Date.parse(drawsAt) : NaN;
  const [parts, setParts] = useState<Parts>(() => Number.isFinite(target) ? diff(target) : { d: 0, h: 0, m: 0, s: 0, expired: true });

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const id = window.setInterval(() => setParts(diff(target)), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  if (!Number.isFinite(target)) {
    return (
      <p className={cn('inline-flex items-center gap-1.5 text-xs text-white/70', compact && 'text-[11px]')}>
        <Clock className="h-3.5 w-3.5" />
        {lang === 'bn' ? 'পরবর্তী ড্রয়ের সময় শীঘ্রই' : 'Next draw time coming soon'}
      </p>
    );
  }

  if (parts.expired) {
    return (
      <p className={cn('inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-200', compact && 'text-[11px]')}>
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-300" />
        {lang === 'bn' ? 'ড্র চলছে' : 'Drawing now'}
      </p>
    );
  }

  const cells: Array<{ value: number; labelEn: string; labelBn: string }> = [];
  if (parts.d > 0) cells.push({ value: parts.d, labelEn: 'd', labelBn: 'দিন' });
  cells.push({ value: parts.h, labelEn: 'h', labelBn: 'ঘণ্টা' });
  cells.push({ value: parts.m, labelEn: 'm', labelBn: 'মিনিট' });
  cells.push({ value: parts.s, labelEn: 's', labelBn: 'সেকেন্ড' });

  return (
    <div className={cn('inline-flex items-center gap-2', compact && 'gap-1.5')}>
      {cells.map((c, i) => (
        <div
          key={i}
          className={cn(
            'min-w-[44px] rounded-lg border border-white/15 bg-black/45 px-2 py-1.5 text-center backdrop-blur',
            compact && 'min-w-[36px] px-1.5 py-1',
          )}
        >
          <p className={cn('text-base font-extrabold tabular-nums leading-none text-white', compact && 'text-sm')}>
            {String(c.value).padStart(2, '0')}
          </p>
          <p className={cn('mt-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-200/85', compact && 'text-[8px]')}>
            {lang === 'bn' ? c.labelBn : c.labelEn}
          </p>
        </div>
      ))}
    </div>
  );
}
