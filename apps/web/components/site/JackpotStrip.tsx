// Built by Anointed Coder.
// Babu88-style jackpot banner with mini / grand / major pools.
// Numbers tick upward gently to feel alive. Pure UI, no real prize pool source.

'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Crown, Trophy } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

export function JackpotStrip() {
  const t = useT();
  const [mini, setMini] = useState(493);
  const [grand, setGrand] = useState(121_497);
  const [major, setMajor] = useState(7_923);

  useEffect(() => {
    const id = setInterval(() => {
      setMini((v) => v + Math.random() * 0.2);
      setGrand((v) => v + Math.random() * 4);
      setMajor((v) => v + Math.random() * 1);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="overflow-hidden rounded-2xl border border-brand-divider bg-brand-ink p-4 text-white shadow-sm md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-bold uppercase tracking-wider text-brand-yellow-400">
          {t('home.jackpot.title')}
        </p>
        <p className="text-[11px] text-white/55">{t('home.jackpot.subtitle')}</p>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        <Pool icon={<Sparkles className="h-4 w-4" />} color="from-brand-yellow-500 to-brand-yellow-700" label={t('home.jackpot.mini')} value={mini} />
        <Pool icon={<Crown className="h-4 w-4" />} color="from-rose-400 to-rose-600" label={t('home.jackpot.grand')} value={grand} highlight />
        <Pool icon={<Trophy className="h-4 w-4" />} color="from-brand-blue-500 to-brand-blue-700" label={t('home.jackpot.major')} value={major} />
      </div>
    </section>
  );
}

function Pool({
  icon,
  color,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${color} px-3 py-2 text-center sm:py-3`}>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.25),transparent_55%)]" aria-hidden />
      <p className="relative inline-flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wider text-white/95">
        {icon} {label}
      </p>
      <p className={`relative mt-0.5 tabular-nums font-black text-white drop-shadow ${highlight ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}>
        {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
