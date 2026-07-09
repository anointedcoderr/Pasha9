// Built by Anointed Coder.
//
// /leaderboard - public live winnings leaderboard.
//
// The always-on primary board is a rolling 24-HOUR WINNINGS ranking: every
// WON WingoBet in the last 24 hours is summed per player (each player once)
// and ranked by highest total winnings. It is served by the read-only
// GET /api/leaderboard/daily. The top three ranks wear distinct medals:
// 1st GOLD, 2nd PLATINUM, 3rd SILVER.
//
// When a WinGo tournament is ACTIVE its hero, prize table and live
// standings are shown above the 24h board (from GET /api/tournaments/active)
// so both surfaces read together. The signed-in player's own tournament
// rank is highlighted. A designed empty state renders when nothing is live.
//
// An admin can turn the whole leaderboard off (leaderboard_enabled): the
// API then returns a disabled marker and this page shows a bilingual
// not-available state, while the nav entry is hidden elsewhere.
//
// Premium Pasha9 dark + gold identity: a self-contained dark board inside
// the light public shell. Animation is transform/opacity only and disabled
// under prefers-reduced-motion. This page is read-only; no money moves.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
import { LiveWinnersFeed } from '@/components/site/LiveWinnersFeed';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import {
  Trophy,
  Crown,
  Timer,
  Coins,
  Gift,
  Users,
  Sparkles,
  ArrowRight,
  Info,
  Medal,
  Zap,
} from 'lucide-react';

const POLL_MS = 15000;

interface PrizeSlot {
  rank: number;
  amount: number;
}
interface StandingRow {
  rank: number;
  handle: string;
  score: number;
  prizeAmount: number;
  isSelf: boolean;
}
interface MeRow {
  rank: number;
  score: number;
  prizeAmount: number;
  handle: string;
}
interface Tournament {
  id: string;
  nameEn: string;
  nameBn: string | null;
  status: string;
  startsAt: string;
  endsAt: string;
  turnoverX: number;
  minTurnover: number;
  prizes: PrizeSlot[];
  participants: number;
  standings: StandingRow[];
  me: MeRow | null;
}
interface AuthShape {
  user?: { username?: string };
}

// One row of the 24h winnings board (mirrors /api/leaderboard/daily).
interface DailyLeader {
  rank: number;
  handle: string;
  winnings: number;
  wins: number;
}

// First initials of a masked handle, for the board avatars.
function initials(handle: string): string {
  const t = handle.trim();
  if (!t) return '?';
  const letters = t.replace(/[^a-zA-Z0-9]/g, '');
  return (letters.slice(0, 2) || t.slice(0, 1)).toUpperCase();
}

type Remaining = { d: number; h: number; m: number; s: number; done: boolean };

function computeRemaining(endsAt: string): Remaining {
  const end = new Date(endsAt).getTime();
  const now = Date.now();
  let diff = Math.max(0, end - now);
  const done = diff <= 0;
  const d = Math.floor(diff / 86400000);
  diff -= d * 86400000;
  const h = Math.floor(diff / 3600000);
  diff -= h * 3600000;
  const m = Math.floor(diff / 60000);
  diff -= m * 60000;
  const s = Math.floor(diff / 1000);
  return { d, h, m, s, done };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Gold / silver / bronze medal tints for the top three ranks of the
// TOURNAMENT standings + prize table. Everyone else gets a neutral dark
// chip. Pure presentation.
function rankTint(rank: number): { ring: string; text: string; bg: string } {
  if (rank === 1) return { ring: 'ring-gold-300/70', text: 'text-gold-300', bg: 'bg-gold-500/15' };
  if (rank === 2) return { ring: 'ring-slate-200/50', text: 'text-slate-100', bg: 'bg-white/10' };
  if (rank === 3) return { ring: 'ring-amber-500/50', text: 'text-amber-300', bg: 'bg-amber-500/10' };
  return { ring: 'ring-white/10', text: 'text-ink-mid', bg: 'bg-white/[0.04]' };
}

// Distinct medal identity for the 24h winnings board top three:
//   1st GOLD, 2nd PLATINUM, 3rd SILVER. Clearly different palettes so the
// podium reads at a glance. Ranks 4+ get a neutral dark chip.
interface Medal3 {
  label: { en: string; bn: string };
  badge: string; // badge background (the rank pill / avatar ring)
  ring: string;
  text: string;
  amountBg: string;
  amountText: string;
  rowBg: string;
  border: string;
}
function medalStyle(rank: number): Medal3 | null {
  if (rank === 1)
    return {
      label: { en: 'Gold', bn: 'গোল্ড' },
      badge: 'bg-gradient-to-b from-gold-300 to-gold-500 text-[#2a1c00]',
      ring: 'ring-gold-300/70',
      text: 'text-gold-300',
      amountBg: 'bg-gold-500/15',
      amountText: 'text-gold-300',
      rowBg: 'bg-[linear-gradient(100%_at_0%_0%,rgba(245,208,97,0.12),transparent_60%)]',
      border: 'border-gold-500/40',
    };
  if (rank === 2)
    return {
      label: { en: 'Platinum', bn: 'প্ল্যাটিনাম' },
      badge: 'bg-gradient-to-b from-cyan-100 to-slate-300 text-slate-900',
      ring: 'ring-cyan-200/60',
      text: 'text-cyan-100',
      amountBg: 'bg-cyan-300/10',
      amountText: 'text-cyan-100',
      rowBg: 'bg-[linear-gradient(100%_at_0%_0%,rgba(165,243,252,0.10),transparent_60%)]',
      border: 'border-cyan-200/30',
    };
  if (rank === 3)
    return {
      label: { en: 'Silver', bn: 'সিলভার' },
      badge: 'bg-gradient-to-b from-slate-200 to-slate-400 text-slate-900',
      ring: 'ring-slate-200/50',
      text: 'text-slate-200',
      amountBg: 'bg-white/[0.06]',
      amountText: 'text-slate-200',
      rowBg: 'bg-[linear-gradient(100%_at_0%_0%,rgba(226,232,240,0.08),transparent_60%)]',
      border: 'border-slate-200/25',
    };
  return null;
}

export default function LeaderboardPage() {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [daily, setDaily] = useState<DailyLeader[]>([]);
  const [dailyLoaded, setDailyLoaded] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/tournaments/active', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      setTournament(data && typeof data === 'object' ? (data.tournament as Tournament | null) : null);
    } catch {
      // best-effort: keep the last good snapshot on a transient failure
    } finally {
      setLoading(false);
    }
  }, []);

  // The 24h winnings board is the always-on primary ranking. Read-only
  // display data; never moves money. A disabled marker gates the page.
  const loadDaily = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/daily', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json().catch(() => null);
      if (data?.enabled === false) {
        setEnabled(false);
        setDaily([]);
        return;
      }
      setEnabled(true);
      if (Array.isArray(data?.rows)) setDaily(data.rows as DailyLeader[]);
    } catch {
      // best-effort: keep the last good snapshot on a transient failure
    } finally {
      setDailyLoaded(true);
    }
  }, []);

  // Initial auth check (to distinguish "signed in but not ranked" from a
  // guest) and the first loads.
  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: AuthShape | null) => {
        if (alive) setAuthed(Boolean(d?.user?.username));
      })
      .catch(() => {
        if (alive) setAuthed(false);
      });
    load();
    loadDaily();
    return () => {
      alive = false;
    };
  }, [load, loadDaily]);

  // Poll standings + the 24h board every ~15s while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
      loadDaily();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load, loadDaily]);

  // 1s tick drives the countdown without re-fetching.
  useEffect(() => {
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const remaining = useMemo(
    () => (tournament ? computeRemaining(tournament.endsAt) : null),
    // now is a dependency so the countdown re-renders every second
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tournament, now],
  );

  const name = tournament ? (bn ? tournament.nameBn?.trim() || tournament.nameEn : tournament.nameEn) : '';
  const me = tournament?.me ?? null;
  const showPlayCta = Boolean(tournament) && !me; // ranked players do not need the nudge

  // Admin turned the section off: a bilingual not-available state, nothing
  // else. The nav entry is hidden separately.
  if (!enabled) {
    return (
      <div className="space-y-5 pb-24 md:pb-6">
        <BackBar title={bn ? 'লিডারবোর্ড' : 'Leaderboard'} />
        <LeaderboardUnavailable bn={bn} />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <BackBar title={bn ? 'লিডারবোর্ড' : 'Leaderboard'} />

      {loading ? (
        <BoardSkeleton />
      ) : (
        <div className="dark-island space-y-5">
          {/* Premium trophy hero: always present so the page reads as a proper
              Leaderboard header, never an empty box. */}
          <LeaderboardHero tournament={tournament} name={name} remaining={remaining} bn={bn} />

          {/* Tournament block, kept ABOVE the always-on 24h board when a
              tournament is live. */}
          {tournament ? (
            <>
              {me ? (
                <YourPosition me={me} bn={bn} />
              ) : showPlayCta ? (
                <PlayCta authed={authed} bn={bn} />
              ) : null}

              {tournament.prizes.length > 0 ? <PrizeTable prizes={tournament.prizes} bn={bn} /> : null}

              <StandingsTable rows={tournament.standings} bn={bn} />

              <p className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-ink-lo">
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/70" />
                <span>
                  {bn
                    ? 'টুর্নামেন্ট র‍্যাঙ্কিং মোট বাজির (WinGo) পরিমাণ অনুসারে। সমান স্কোর হলে যিনি আগে খেলা শুরু করেছেন তিনি এগিয়ে থাকেন। টুর্নামেন্ট শেষ হলে পুরস্কার স্বয়ংক্রিয়ভাবে বিজয়ীর মূল ব্যালেন্সে যোগ হয়।'
                    : 'Tournament ranking is by total WinGo wagered. Ties are broken by earliest activity first, so the player who started earlier ranks higher. Prizes are paid automatically to each winner main balance when the tournament ends.'}
                </span>
              </p>
            </>
          ) : null}

          {/* Always-on primary board: the rolling 24h winnings ranking. */}
          <DailyWinningsBoard rows={daily} loaded={dailyLoaded} bn={bn} />

          {/* When no tournament is running, a teaser keeps the page full. */}
          {!tournament ? <NextTournamentTeaser authed={authed} bn={bn} /> : null}
        </div>
      )}

      {/* Recent Winners: a live, public, masked feed of recent real wins.
          Rendered under the board so it is present whether or not a
          tournament is active. It self-hides when its section is off. */}
      <LiveWinnersFeed />
    </div>
  );
}

// ---------- Not-available state ----------

function LeaderboardUnavailable({ bn }: { bn: boolean }) {
  return (
    <div className="dark-island">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(130%_150%_at_15%_0%,#141821_0%,#0b0e14_55%,#05070b_100%)] px-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.05] text-ink-mid ring-1 ring-white/10">
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-en text-xl font-black text-ink-hi">
          {bn ? 'লিডারবোর্ড এখন বন্ধ' : 'Leaderboard is off right now'}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-ink-mid">
          {bn
            ? 'এই মুহূর্তে লিডারবোর্ড উপলব্ধ নেই। শীঘ্রই আবার দেখুন।'
            : 'The leaderboard is not available at the moment. Please check back soon.'}
        </p>
        <Link
          href="/games/wingo"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-grad-gold px-5 py-2.5 font-en text-sm font-extrabold text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition active:scale-95"
        >
          {bn ? 'WinGo খেলুন' : 'Play WinGo'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}

// ---------- Leaderboard hero ----------

function LeaderboardHero({
  tournament,
  name,
  remaining,
  bn,
}: {
  tournament: Tournament | null;
  name: string;
  remaining: Remaining | null;
  bn: boolean;
}) {
  const active = Boolean(tournament);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-500/30 bg-[radial-gradient(130%_150%_at_15%_0%,#1b1206_0%,#0b0e14_55%,#05070b_100%)] px-5 py-7 shadow-[0_22px_54px_-26px_rgba(0,0,0,0.85)]">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-16 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(245,208,97,0.24),transparent_65%)] motion-safe:animate-floaty"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-12 bottom-[-35%] h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(54,255,154,0.10),transparent_70%)]"
      />
      <div className="relative flex flex-col items-center text-center">
        {/* Trophy medallion with a soft breathing glow ring */}
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-grad-gold text-[#2a1c00] shadow-[0_12px_32px_-8px_rgba(245,208,97,0.65),inset_0_1px_0_rgba(255,255,255,0.6)]">
          <span
            aria-hidden
            className="pointer-events-none absolute -inset-1.5 rounded-[20px] ring-2 ring-gold-300/40 motion-safe:animate-pulseGlow"
          />
          <Trophy className="h-10 w-10" />
        </div>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-300">
          {active ? <Trophy className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {active ? (bn ? 'উইনগো টুর্নামেন্ট' : 'WinGo Tournament') : bn ? 'লিডারবোর্ড' : 'Leaderboard'}
        </span>

        <h1 className="mt-3 font-en text-2xl font-black leading-tight text-ink-hi md:text-3xl">
          {active ? name : bn ? 'লিডারবোর্ড' : 'Leaderboard'}
        </h1>

        {active ? (
          <>
            <p className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-mid">
              <span className="inline-flex items-center gap-1">
                <Users className="h-3.5 w-3.5 text-gold-300/80" />
                {tournament!.participants} {bn ? 'জন অংশগ্রহণকারী' : 'players in'}
              </span>
              {tournament!.turnoverX > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-gold-300/80" />
                  {tournament!.turnoverX}x {bn ? 'টার্নওভার' : 'turnover'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <Coins className="h-3.5 w-3.5 text-neon/80" />
                  {bn ? 'বিশুদ্ধ ক্যাশ পুরস্কার' : 'Pure cash prizes'}
                </span>
              )}
            </p>
            <div className="w-full">
              <Countdown remaining={remaining} bn={bn} />
            </div>
          </>
        ) : (
          <p className="mt-2 max-w-xs text-sm text-ink-mid">
            {bn
              ? 'WinGo খেলুন, র‍্যাঙ্কে উঠুন এবং সত্যিকারের ক্যাশ পুরস্কার জিতুন। নিচে গত ২৪ ঘণ্টার সেরা বিজয়ীরা।'
              : 'Play WinGo, climb the ranks and win real cash. Below are the top winners of the last 24 hours.'}
          </p>
        )}
      </div>
    </section>
  );
}

// ---------- 24-hour winnings board (always on) ----------

function DailyWinningsBoard({
  rows,
  loaded,
  bn,
}: {
  rows: DailyLeader[];
  loaded: boolean;
  bn: boolean;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-[#0b0e14]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="min-w-0">
          <h2 className="inline-flex items-center gap-2 font-en text-sm font-extrabold text-ink-hi">
            <Crown className="h-4 w-4 text-gold-300" />
            {bn ? '২৪ ঘণ্টার সেরা বিজয়ী' : '24h top winners'}
          </h2>
          <p className="mt-0.5 text-[11px] text-ink-lo">
            {bn ? 'গত ২৪ ঘণ্টার মোট জয় অনুসারে র‍্যাঙ্ক' : 'Ranked by total winnings in the last 24 hours'}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink-lo">
          <span className="h-1.5 w-1.5 rounded-full bg-neon motion-safe:animate-pulseGlow" aria-hidden />
          {bn ? 'লাইভ' : 'Live'}
        </span>
      </div>

      {!loaded ? (
        <ul className="divide-y divide-white/5" role="status" aria-label={bn ? 'লোড হচ্ছে' : 'Loading'}>
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-white/[0.05]" />
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-white/[0.05]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-24 animate-pulse rounded bg-white/[0.05]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-white/[0.04]" />
              </div>
              <div className="h-5 w-16 animate-pulse rounded bg-white/[0.05]" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <Crown className="h-8 w-8 text-gold-300" aria-hidden />
          <p className="font-en text-sm font-extrabold text-ink-hi">
            {bn ? 'প্রথম বিজয়ী হোন' : 'Be the first winner'}
          </p>
          <p className="max-w-xs text-xs text-ink-lo">
            {bn
              ? 'গত ২৪ ঘণ্টায় এখনও কোনো জয় নেই। WinGo খেলুন এবং এই বোর্ডে শীর্ষে উঠুন।'
              : 'No wins in the last 24 hours yet. Play WinGo and top this board.'}
          </p>
          <Link
            href="/games/wingo"
            className="mt-1 inline-flex items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-5 py-2.5 font-en text-sm font-bold text-black shadow-lg shadow-gold-500/20 transition active:scale-95"
          >
            {bn ? 'WinGo খেলুন' : 'Play WinGo'}
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((r) => {
            const medal = medalStyle(r.rank);
            return (
              <li
                key={`${r.rank}-${r.handle}`}
                className={`flex items-center gap-3 px-4 py-3 ${medal ? `${medal.rowBg} border-l-2 ${medal.border}` : ''}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ${
                    medal
                      ? medal.badge
                      : 'bg-white/[0.04] text-ink-mid ring-1 ring-white/10'
                  }`}
                >
                  {medal ? <Medal className="h-4 w-4" /> : r.rank}
                </span>
                <span
                  aria-hidden
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-en text-xs font-black ring-1 ${
                    medal ? `${medal.amountBg} ${medal.text} ${medal.ring}` : 'bg-neon/10 text-neon ring-neon/25'
                  }`}
                >
                  {initials(r.handle)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-en text-[15px] font-extrabold leading-tight text-ink-hi">
                    {r.handle}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] font-medium">
                    {medal ? (
                      <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${medal.amountBg} ${medal.amountText}`}>
                        {bn ? medal.label.bn : medal.label.en}
                      </span>
                    ) : (
                      <span className="text-ink-mid">#{r.rank}</span>
                    )}
                    <span aria-hidden className="text-ink-lo">·</span>
                    <span className="inline-flex items-center gap-0.5 text-ink-lo">
                      <Zap className="h-3 w-3" />
                      {r.wins} {bn ? 'জয়' : r.wins === 1 ? 'win' : 'wins'}
                    </span>
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 font-en text-sm font-black tabular-nums ${
                    medal ? `${medal.amountBg} ${medal.amountText}` : 'bg-neon/10 text-neon'
                  }`}
                >
                  {formatBDT(r.winnings)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="flex items-start gap-2 border-t border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-ink-lo">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/70" />
        <span>
          {bn
            ? 'গত ২৪ ঘণ্টার সব WinGo জয়ের মোট পরিমাণ অনুসারে র‍্যাঙ্ক। প্রতিটি খেলোয়াড় একবারই দেখানো হয়। নাম গোপন রাখা হয়েছে।'
            : 'Ranked by each player total WinGo winnings over the last 24 hours. Every player appears once. Names are masked for privacy.'}
        </span>
      </p>
    </section>
  );
}

// ---------- Next-tournament teaser (shown when no tournament is active) ----------

function NextTournamentTeaser({ authed, bn }: { authed: boolean; bn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-[linear-gradient(135deg,#161008_0%,#0a0d13_60%)] px-5 py-5">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(245,208,97,0.16),transparent_65%)]"
      />
      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-500/12 text-gold-300 ring-1 ring-gold-300/40">
            <Timer className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-en text-sm font-extrabold text-ink-hi">
              {bn ? 'পরবর্তী টুর্নামেন্ট শীঘ্রই' : 'Next tournament soon'}
            </p>
            <p className="mt-0.5 text-xs text-ink-mid">
              {bn
                ? 'এখনই WinGo খেলে টার্নওভার গড়ে তুলুন, শুরু হলেই শীর্ষে থাকুন।'
                : 'Build turnover on WinGo now so you start on top when the next one opens.'}
            </p>
          </div>
        </div>
        <Link
          href={authed ? '/games/wingo' : '/?login=1'}
          className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-1.5 rounded-xl bg-grad-gold px-5 text-sm font-extrabold uppercase tracking-wider text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 motion-safe:active:scale-95 sm:w-auto"
        >
          {authed ? (bn ? 'WinGo খেলুন' : 'Play WinGo') : bn ? 'লগইন করে খেলুন' : 'Sign in to play'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}

// ---------- Countdown ----------

function Countdown({ remaining, bn }: { remaining: Remaining | null; bn: boolean }) {
  if (!remaining) return null;
  if (remaining.done) {
    return (
      <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-neon/30 bg-neon/10 px-4 py-2.5 text-sm font-bold text-neon">
        <Timer className="h-4 w-4" />
        {bn ? 'শেষ - পুরস্কার প্রদান চলছে' : 'Ended - paying out prizes'}
      </div>
    );
  }
  const cells: Array<{ v: number; en: string; bn: string }> = [
    { v: remaining.d, en: 'Days', bn: 'দিন' },
    { v: remaining.h, en: 'Hrs', bn: 'ঘন্টা' },
    { v: remaining.m, en: 'Min', bn: 'মিনিট' },
    { v: remaining.s, en: 'Sec', bn: 'সেকেন্ড' },
  ];
  return (
    <div className="mt-5">
      <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-lo">
        <Timer className="h-3.5 w-3.5 text-gold-300/80" />
        {bn ? 'শেষ হতে বাকি' : 'Ends in'}
      </p>
      <div className="flex gap-2" role="timer" aria-live="off">
        {cells.map((c) => (
          <div
            key={c.en}
            className="flex min-w-[58px] flex-1 flex-col items-center rounded-xl border border-gold-500/20 bg-black/40 px-2 py-2.5"
          >
            <span className="font-en text-2xl font-black tabular-nums text-ink-hi md:text-3xl">{pad(c.v)}</span>
            <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-lo">{bn ? c.bn : c.en}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Your position ----------

function YourPosition({ me, bn }: { me: MeRow; bn: boolean }) {
  const inMoney = me.prizeAmount > 0;
  return (
    <section
      aria-label={bn ? 'আপনার অবস্থান' : 'Your position'}
      className="relative overflow-hidden rounded-2xl border border-gold-300/50 bg-[linear-gradient(135deg,#1a1305_0%,#0d0f16_60%)] px-4 py-4 shadow-[0_0_28px_-8px_rgba(245,208,97,0.35)]"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl bg-grad-gold text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)]">
          <span className="text-[9px] font-bold uppercase leading-none tracking-wider">{bn ? 'র‍্যাঙ্ক' : 'Rank'}</span>
          <span className="font-en text-xl font-black leading-tight tabular-nums">#{me.rank}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-gold-300">{bn ? 'আপনার অবস্থান' : 'Your position'}</p>
          <p className="mt-0.5 truncate font-en text-lg font-extrabold text-ink-hi">
            {formatBDT(me.score)} <span className="text-xs font-semibold text-ink-lo">{bn ? 'বাজি' : 'wagered'}</span>
          </p>
        </div>
        {inMoney ? (
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-lo">{bn ? 'পুরস্কার' : 'Prize'}</p>
            <p className="font-en text-lg font-black tabular-nums text-neon">{formatBDT(me.prizeAmount)}</p>
          </div>
        ) : (
          <Link
            href="/games/wingo"
            className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-grad-gold px-3.5 text-xs font-extrabold uppercase tracking-wider text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 motion-safe:active:scale-95"
          >
            {bn ? 'উপরে উঠুন' : 'Climb'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </section>
  );
}

// ---------- Play CTA (signed in but unranked, or guest) ----------

function PlayCta({ authed, bn }: { authed: boolean; bn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(135deg,#0d1017_0%,#0a0d13_100%)] px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-500/12 text-gold-300">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-en text-sm font-extrabold text-ink-hi">
            {authed
              ? bn
                ? 'আপনি এখনো র‍্যাঙ্কে নেই'
                : 'You are not ranked yet'
              : bn
                ? 'লিডারবোর্ডে উঠুন'
                : 'Get on the leaderboard'}
          </p>
          <p className="mt-0.5 text-xs text-ink-mid">
            {bn ? 'WinGo খেলুন এবং পুরস্কার জিততে র‍্যাঙ্কে উঠুন।' : 'Play WinGo to climb the ranks and win prizes.'}
          </p>
        </div>
        <Link
          href={authed ? '/games/wingo' : '/?login=1'}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-xl bg-grad-gold px-4 text-xs font-extrabold uppercase tracking-wider text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 motion-safe:active:scale-95"
        >
          {authed ? (bn ? 'খেলুন' : 'Play') : bn ? 'লগইন' : 'Sign in'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}

// ---------- Prize table ----------

function PrizeTable({ prizes, bn }: { prizes: PrizeSlot[]; bn: boolean }) {
  const total = prizes.reduce((sum, p) => sum + p.amount, 0);
  return (
    <section className="overflow-hidden rounded-2xl border border-gold-500/20 bg-[#0b0e14]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 font-en text-sm font-extrabold text-ink-hi">
          <Gift className="h-4 w-4 text-gold-300" />
          {bn ? 'পুরস্কার তালিকা' : 'Prize pool'}
        </h2>
        <span className="rounded-full bg-neon/10 px-2.5 py-1 text-[11px] font-bold tabular-nums text-neon">{formatBDT(total)}</span>
      </div>
      <ul className="divide-y divide-white/5">
        {prizes.map((p) => {
          const tint = rankTint(p.rank);
          return (
            <li key={p.rank} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ring-1 ${tint.ring} ${tint.bg} ${tint.text}`}
              >
                {p.rank <= 3 ? <Crown className="h-4 w-4" /> : p.rank}
              </span>
              <span className="flex-1 text-sm font-semibold text-ink-mid">
                {bn ? `${p.rank} নং স্থান` : `Rank ${p.rank}`}
              </span>
              <span className="font-en text-sm font-black tabular-nums text-gold-300">{formatBDT(p.amount)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- Standings ----------

function StandingsTable({ rows, bn }: { rows: StandingRow[]; bn: boolean }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b0e14]">
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <h2 className="inline-flex items-center gap-2 font-en text-sm font-extrabold text-ink-hi">
          <Trophy className="h-4 w-4 text-gold-300" />
          {bn ? 'টুর্নামেন্ট স্ট্যান্ডিং' : 'Tournament standings'}
        </h2>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-lo">
          <span className="h-1.5 w-1.5 rounded-full bg-neon motion-safe:animate-pulseGlow" aria-hidden />
          {bn ? 'লাইভ' : 'Live'}
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-lo">
          {bn ? 'এখনো কেউ যোগ্যতা অর্জন করেনি। প্রথম হোন!' : 'No qualifying players yet. Be the first!'}
        </p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rows.map((r) => {
            const tint = rankTint(r.rank);
            const inMoney = r.prizeAmount > 0;
            return (
              <li
                key={`${r.rank}-${r.handle}`}
                className={`flex items-center gap-3 px-4 py-2.5 ${r.isSelf ? 'bg-gold-500/10' : ''}`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black tabular-nums ring-1 ${tint.ring} ${tint.bg} ${tint.text}`}
                >
                  {r.rank}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-bold text-ink-hi">
                    {r.handle}
                    {r.isSelf ? (
                      <span className="rounded-full bg-gold-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gold-300">
                        {bn ? 'আপনি' : 'You'}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-[11px] tabular-nums text-ink-lo">
                    {formatBDT(r.score)} {bn ? 'বাজি' : 'wagered'}
                  </p>
                </div>
                {inMoney ? (
                  <span className="shrink-0 rounded-lg bg-neon/10 px-2 py-1 text-xs font-black tabular-nums text-neon">
                    {formatBDT(r.prizeAmount)}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Skeleton ----------

function BoardSkeleton() {
  return (
    <div className="space-y-5" role="status" aria-label="Loading leaderboard">
      <div className="h-40 animate-pulse rounded-2xl border border-white/5 bg-[#0b0e14]" />
      <div className="h-20 animate-pulse rounded-2xl border border-white/5 bg-[#0b0e14]" />
      <div className="space-y-2 rounded-2xl border border-white/5 bg-[#0b0e14] p-4">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}
