// Built by Anointed Coder.
//
// Babu-style sports fixtures rail. Renders an active list of
// SportsEvent rows as horizontal cards with a yellow header,
// status pill, league line, date/time and two team rows. Tapping a
// card opens the configured deepLinkUrl (provider event), or falls
// back to the homepage /sports landing when no link is set. The
// carousel polls /api/content/sports-events every 60 seconds while
// visible so live status changes appear without a hard reload.

'use client';

import { useEffect, useState } from 'react';
import { ChevronRight, Flag } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface FixtureRow {
  id: string;
  sportType: string;
  status: 'upcoming' | 'live' | 'ended';
  leagueNameEn: string;
  leagueNameBn: string | null;
  startsAt: string;
  teamAName: string;
  teamAShortName: string | null;
  teamALogoUrl: string | null;
  teamBName: string;
  teamBShortName: string | null;
  teamBLogoUrl: string | null;
  providerName: string | null;
  deepLinkUrl: string | null;
  sortOrder: number;
}

const formatDateTime = (iso: string, lang: 'en' | 'bn'): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return d.toISOString().replace('T', ' ').slice(0, 16);
  }
};

export function SportsFixturesCarousel() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [events, setEvents] = useState<FixtureRow[] | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch('/api/content/sports-events', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!alive) return;
          setEvents(Array.isArray(j?.events) ? (j.events as FixtureRow[]) : []);
        })
        .catch(() => { if (alive) setEvents([]); });
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);

  // Caller renders this side-by-side with the provider entry cards
  // (SportsbookSection). When events is null we are still loading;
  // returning null keeps the section quiet rather than blank.
  if (events === null) return null;
  if (events.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_6px_14px_-6px_rgba(245,180,0,0.7)]">
            <Flag className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="inline-flex items-baseline gap-2 truncate text-lg font-extrabold text-brand-ink md:text-xl">
              <span>{bn ? 'উপকামিং ম্যাচ' : 'Upcoming Fixtures'}</span>
              <span aria-hidden className="h-[2px] w-10 rounded-full bg-gradient-to-r from-brand-yellow-500/80 to-transparent" />
            </h2>
            <p className="text-xs text-brand-inkMute">{bn ? 'লাইভ এবং আসন্ন স্পোর্টস ফিকশ্চার' : 'Live and upcoming sports fixtures'}</p>
          </div>
        </div>
      </div>

      <div className="-mx-3 overflow-x-auto px-3 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-3 pb-1">
          {events.map((ev) => {
            const league = bn && ev.leagueNameBn ? ev.leagueNameBn : ev.leagueNameEn;
            const dt = formatDateTime(ev.startsAt, lang);
            const href = ev.deepLinkUrl || '/sports';
            const card = (
              <article
                key={ev.id}
                className="group relative flex h-full w-[280px] shrink-0 flex-col overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper shadow-[0_4px_18px_-12px_rgba(15,17,21,0.18)] transition hover:border-brand-yellow-500/60 hover:shadow-[0_12px_28px_-14px_rgba(245,180,0,0.35)] sm:w-[300px]"
              >
                <div className="flex items-center justify-between gap-2 bg-gradient-to-b from-brand-yellow-400 via-brand-yellow-500 to-[#F5B400] px-3 py-2 text-[#3A1F00]">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                      ev.status === 'live'
                        ? 'bg-rose-600 text-white'
                        : 'bg-black/85 text-white',
                    )}
                  >
                    {ev.status === 'live' ? (
                      <>
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                        {bn ? 'লাইভ' : 'Live'}
                      </>
                    ) : (
                      bn ? 'আসন্ন' : 'Upcoming'
                    )}
                  </span>
                  <span className="truncate text-[11px] font-bold uppercase tracking-wider">{league}</span>
                </div>
                <div className="flex flex-1 flex-col gap-2 px-3 py-3">
                  <p className="text-[11px] font-semibold text-brand-inkMute">{dt}</p>
                  <TeamRow name={ev.teamAName} shortName={ev.teamAShortName} logoUrl={ev.teamALogoUrl} />
                  <TeamRow name={ev.teamBName} shortName={ev.teamBShortName} logoUrl={ev.teamBLogoUrl} />
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase tracking-wider text-brand-inkMute">
                      {ev.providerName ?? (bn ? 'স্পোর্টসবুক' : 'Sportsbook')}
                    </span>
                    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-brand-ink px-3 text-[10px] font-extrabold uppercase tracking-wider text-white group-hover:bg-emerald-600">
                      {bn ? 'বাজি ধরুন' : 'Bet now'}
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              </article>
            );
            return (
              <li key={ev.id}>
                <a
                  href={href}
                  target={ev.deepLinkUrl ? '_blank' : undefined}
                  rel={ev.deepLinkUrl ? 'noreferrer noopener' : undefined}
                  className="block h-full"
                >
                  {card}
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

function TeamRow({ name, shortName, logoUrl }: { name: string; shortName: string | null; logoUrl: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md border border-brand-divider bg-brand-surface">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="text-[8px] font-bold uppercase tracking-wider text-brand-inkMute">
            {(shortName ?? name).slice(0, 3)}
          </span>
        )}
      </span>
      <p className="truncate text-sm font-semibold text-brand-ink">{name}</p>
    </div>
  );
}
