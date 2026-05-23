// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CategoryHero } from '@/components/site/CategoryHero';
import { useT, useLang } from '@/lib/i18n/context';
import { Ticket, Lock, Clock, Trophy, Zap } from 'lucide-react';
import { formatBDT, formatDateTime } from '@/lib/utils/format';

interface Draw {
  id: string;
  name: string;
  schedule: string;
  ticketPrice: number;
  prizePool: number;
  digits: string[];
  drawsAt: string;
  accent: 'yellow' | 'blue' | 'red' | 'royal';
}

interface LiveDraw {
  id: string;
  name: string;
  schedule: string | null;
  drawsAt: string | null;
  digitsCount: number;
  ticketPrice: number | string;
  prizePool: number | string;
  accent: Draw['accent'];
}

function future(daysFromNow: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const FALLBACK: Draw[] = [
  { id: 'd1', name: 'Daily 4D', schedule: 'Daily 21:00', ticketPrice: 20, prizePool: 1_500_000, digits: ['?', '?', '?', '?'], drawsAt: future(0, 21), accent: 'yellow' },
  { id: 'd2', name: 'Mega Friday', schedule: 'Friday 22:30', ticketPrice: 50, prizePool: 8_500_000, digits: ['?', '?', '?', '?', '?'], drawsAt: future(3, 22), accent: 'red' },
  { id: 'd3', name: 'Numbers Rush', schedule: 'Daily 17:30', ticketPrice: 10, prizePool: 450_000, digits: ['?', '?', '?'], drawsAt: future(0, 17), accent: 'blue' },
  { id: 'd4', name: 'Lotto Super 6', schedule: 'Saturday 20:00', ticketPrice: 30, prizePool: 3_200_000, digits: ['?', '?', '?', '?', '?', '?'], drawsAt: future(4, 20), accent: 'royal' },
];

function adaptLive(live: LiveDraw): Draw {
  return {
    id: live.id,
    name: live.name,
    schedule: live.schedule ?? '',
    ticketPrice: Number(live.ticketPrice),
    prizePool: Number(live.prizePool),
    digits: Array(Math.max(1, Math.min(10, live.digitsCount))).fill('?'),
    drawsAt: live.drawsAt ?? future(0, 21),
    accent: live.accent,
  };
}

const GRAD: Record<Draw['accent'], string> = {
  yellow: 'from-brand-yellow-400 via-amber-500 to-orange-500',
  blue: 'from-brand-blue-500 via-brand-blue-600 to-brand-blue-700',
  red: 'from-rose-500 via-red-600 to-orange-600',
  royal: 'from-fuchsia-500 via-indigo-600 to-indigo-800',
};

export default function LottoPage() {
  const t = useT();
  const { lang } = useLang();
  const [draws, setDraws] = useState<Draw[]>(FALLBACK);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/lotto')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const live = Array.isArray(data?.draws) ? (data.draws as LiveDraw[]) : [];
        if (alive && live.length) setDraws(live.map(adaptLive));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <div className="space-y-6">
      <CategoryHero
        kicker={t('lotto.title')}
        title={t('lotto.title')}
        description={t('lotto.subtitle')}
        accent="yellow"
      />

      <section className="grid gap-4 md:grid-cols-2">
        {draws.map((d) => (
          <article key={d.id} className={`relative overflow-hidden rounded-2xl text-white bg-gradient-to-br ${GRAD[d.accent]}`}>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_30%,rgba(255,255,255,0.25),transparent_55%)]" />
            <div className="relative grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-6 md:px-7 md:py-7">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-white/85">{d.schedule}</p>
                <h3 className="mt-1 text-xl font-extrabold leading-tight md:text-2xl">{d.name}</h3>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {d.digits.map((digit, i) => (
                    <span
                      key={i}
                      className="flex h-9 w-9 items-center justify-center rounded-md bg-white/15 text-base font-extrabold backdrop-blur"
                    >
                      {digit}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <Cell label={lang === 'bn' ? 'প্রাইজ পুল' : 'Prize Pool'} value={formatBDT(d.prizePool, { compact: true })} />
                  <Cell label={lang === 'bn' ? 'টিকেট মূল্য' : 'Ticket'} value={formatBDT(d.ticketPrice)} />
                </div>

                <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-white/85">
                  <Clock className="h-3 w-3" />
                  {t('lotto.drawTitle')}: {formatDateTime(d.drawsAt, lang)}
                </p>

                <Link
                  href="/?signup=1"
                  className="btn-yellow mt-4 inline-flex h-10 items-center rounded-lg px-4 text-sm font-bold text-brand-ink"
                  title={t('lotto.comingSoon')}
                >
                  <Ticket className="mr-1.5 h-4 w-4" />
                  {t('lotto.buyTicket')}
                </Link>
              </div>

              <div className="hidden md:block">
                <BigTicket />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="card-light p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
            <Trophy className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-extrabold text-brand-ink">{t('lotto.howTitle')}</h2>
            <ol className="mt-3 grid gap-3 text-sm text-brand-inkSoft md:grid-cols-3">
              <Step n={1} icon={<Ticket className="h-4 w-4" />} text={lang === 'bn' ? 'টিকেট কিনুন এবং নাম্বার পছন্দ করুন' : 'Pick your numbers and buy a ticket'} />
              <Step n={2} icon={<Zap className="h-4 w-4" />} text={lang === 'bn' ? 'নির্ধারিত সময়ে ড্র অনুষ্ঠিত হয়' : 'Draw runs at the scheduled time'} />
              <Step n={3} icon={<Trophy className="h-4 w-4" />} text={lang === 'bn' ? 'মিল হলে পুরস্কার দাবি করুন' : 'Match the numbers and claim the prize'} />
            </ol>
            <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-brand-yellow-500/15 px-3 py-1 text-[11px] font-semibold text-brand-yellow-700">
              <Lock className="h-3.5 w-3.5" /> {t('lotto.comingSoon')}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Step({ n, icon, text }: { n: number; icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-brand-divider bg-brand-surface p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-yellow-500 text-brand-ink font-bold">
        {n}
      </span>
      <div>
        <p className="text-sm font-semibold text-brand-ink">{text}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-brand-inkMute">{icon}</p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2.5 py-2 backdrop-blur">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-white/75">{label}</dt>
      <dd className="mt-0.5 font-extrabold text-white tabular-nums">{value}</dd>
    </div>
  );
}

function BigTicket() {
  return (
    <svg viewBox="0 0 160 200" className="h-[180px] w-[150px]">
      <rect x="6" y="6" width="148" height="188" rx="14" fill="rgba(255,255,255,0.18)" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />
      <rect x="20" y="22" width="120" height="38" rx="6" fill="#FFCC00" />
      <text x="80" y="48" textAnchor="middle" fontSize="16" fontWeight="800" fill="#0F1115">LOTTO</text>
      <text x="80" y="84" textAnchor="middle" fontSize="32" fontWeight="800" fill="#FFFFFF">9</text>
      <line x1="20" y1="110" x2="140" y2="110" stroke="rgba(255,255,255,0.4)" strokeDasharray="4 4" />
      <rect x="20" y="120" width="60" height="10" rx="3" fill="rgba(255,255,255,0.55)" />
      <rect x="20" y="138" width="80" height="10" rx="3" fill="rgba(255,255,255,0.35)" />
      <rect x="20" y="156" width="40" height="10" rx="3" fill="rgba(255,255,255,0.35)" />
    </svg>
  );
}
