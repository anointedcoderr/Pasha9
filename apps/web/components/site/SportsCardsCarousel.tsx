// Built by Anointed Coder.
// Horizontal carousel of upcoming match cards. Yellow header strip per match
// with the league name and start time, then home + away team rows with a
// coloured monogram and the team name.

'use client';

import { useRef } from 'react';
import { ChevronLeft, ChevronRight, Trophy } from 'lucide-react';
import { useT, useLang } from '@/lib/i18n/context';
import { mockUpcomingMatches, type UpcomingMatch } from '@/lib/mock/upcomingMatches';
import { formatDateTime } from '@/lib/utils/format';

export function SportsCardsCarousel() {
  const t = useT();
  const { lang } = useLang();
  const scroller = useRef<HTMLDivElement>(null);

  const scroll = (dir: -1 | 1) => {
    scroller.current?.scrollBy({ left: dir * 320, behavior: 'smooth' });
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-yellow-500 text-brand-ink">
            <Trophy className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">{t('home.sports.title')}</h2>
            <p className="text-xs text-brand-inkMute">{t('home.sports.subtitle')}</p>
          </div>
        </div>
        <div className="hidden gap-2 md:flex">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scroll(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-divider bg-brand-paper text-brand-inkSoft hover:border-brand-yellow-500"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scroll(1)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-brand-divider bg-brand-paper text-brand-inkSoft hover:border-brand-yellow-500"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={scroller}
        className="mask-fade-x flex gap-3 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
        {mockUpcomingMatches.map((m) => (
          <MatchCard key={m.id} match={m} lang={lang} />
        ))}
      </div>
    </section>
  );
}

function MatchCard({ match, lang }: { match: UpcomingMatch; lang: 'bn' | 'en' }) {
  return (
    <article className="w-[260px] shrink-0 overflow-hidden rounded-xl border border-brand-divider bg-brand-paper">
      <div className="flex items-center justify-between gap-2 bg-brand-yellow-500 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand-ink">
        <span className="truncate">{match.league}</span>
      </div>
      <div className="px-3 py-3 text-xs text-brand-inkMute">{formatDateTime(match.startsAt, lang)}</div>
      <TeamRow color={match.homeColor} name={match.homeTeam} />
      <TeamRow color={match.awayColor} name={match.awayTeam} />
    </article>
  );
}

function TeamRow({ color, name }: { color: string; name: string }) {
  return (
    <div className="flex items-center gap-3 border-t border-brand-divider px-3 py-2.5">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ background: color }}
      >
        {name.split(' ').slice(0, 2).map((w) => w[0]).join('')}
      </span>
      <span className="truncate text-sm font-semibold text-brand-ink">{name}</span>
    </div>
  );
}
