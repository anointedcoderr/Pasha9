'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

export function JackpotTicker() {
  const [value, setValue] = useState(12_854_320);

  useEffect(() => {
    const id = setInterval(() => setValue((v) => v + Math.floor(Math.random() * 1300) + 200), 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-card border border-gold-500/25 bg-base-panel/60 px-4 py-3 ring-gold-soft">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-grad-gold text-base-deep">
        <TrendingUp className="h-4 w-4" />
      </span>
      <div>
        <p className="text-xs uppercase tracking-wider text-ink-lo">Jackpot Pool</p>
        <p className="text-lg font-extrabold text-gradient-gold tabular-nums">{formatBDT(value)}</p>
      </div>
    </div>
  );
}
