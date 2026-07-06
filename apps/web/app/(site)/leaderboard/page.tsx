// Built by Anointed Coder.
//
// /leaderboard - public live WinGo tournament leaderboard.
//
// Client page consuming GET /api/tournaments/active. It shows the single
// active tournament: its bilingual name, the prize table (rank -> amount),
// a live countdown to endsAt, and the frozen-on-end top standings ranked
// by total wagered. Standings poll every ~15s. The signed-in player's own
// rank + score is highlighted (resolved across the FULL standings by the
// API, even when they sit outside the visible slice), with a call to
// action to play WinGo when they have not yet ranked. A designed empty
// state renders when no tournament is active.
//
// Premium Pasha9 dark + gold identity: a self-contained dark board with
// gold accents living inside the light public shell. Animation is limited
// to transform/opacity and is disabled under prefers-reduced-motion.
// No API or engine logic is changed here; this page is read-only.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { BackBar } from '@/components/site/BackBar';
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

// Gold / silver / bronze medal tints for the top three ranks. Everyone
// else gets a neutral dark chip. Pure presentation.
function rankTint(rank: number): { ring: string; text: string; bg: string } {
  if (rank === 1) return { ring: 'ring-gold-300/70', text: 'text-gold-300', bg: 'bg-gold-500/15' };
  if (rank === 2) return { ring: 'ring-slate-200/50', text: 'text-slate-100', bg: 'bg-white/10' };
  if (rank === 3) return { ring: 'ring-amber-500/50', text: 'text-amber-300', bg: 'bg-amber-500/10' };
  return { ring: 'ring-white/10', text: 'text-ink-mid', bg: 'bg-white/[0.04]' };
}

export default function LeaderboardPage() {
  const { lang } = useLang();
  const bn = lang === 'bn';

  const [tournament, setTournament] = useState<Tournament | null>(null);
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

  // Initial auth check (to distinguish "signed in but not ranked" from a
  // guest) and the first standings load.
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
    return () => {
      alive = false;
    };
  }, [load]);

  // Poll standings every ~15s while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      load();
    }, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

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

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <BackBar title={bn ? 'লিডারবোর্ড' : 'Leaderboard'} />

      {loading ? (
        <BoardSkeleton />
      ) : !tournament ? (
        <EmptyState bn={bn} />
      ) : (
        <div className="space-y-5">
          {/* Hero: name, status, countdown */}
          <section className="relative overflow-hidden rounded-2xl border border-gold-500/25 bg-[radial-gradient(120%_140%_at_15%_0%,#16110a_0%,#0b0e14_55%,#070a0f_100%)] px-5 py-6 shadow-[0_18px_44px_-24px_rgba(0,0,0,0.8)]">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-[radial-gradient(circle,rgba(245,208,97,0.22),transparent_65%)] motion-safe:animate-floaty"
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-500/40 bg-gold-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold-300">
                <Trophy className="h-3.5 w-3.5" />
                {bn ? 'উইনগো টুর্নামেন্ট' : 'WinGo Tournament'}
              </span>
              <h1 className="mt-3 font-en text-2xl font-extrabold leading-tight text-ink-hi md:text-3xl">{name}</h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-mid">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-gold-300/80" />
                  {tournament.participants} {bn ? 'জন অংশগ্রহণকারী' : 'players in'}
                </span>
                {tournament.turnoverX > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-gold-300/80" />
                    {tournament.turnoverX}x {bn ? 'টার্নওভার' : 'turnover'}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Coins className="h-3.5 w-3.5 text-neon/80" />
                    {bn ? 'বিশুদ্ধ ক্যাশ পুরস্কার' : 'Pure cash prizes'}
                  </span>
                )}
              </p>

              <Countdown remaining={remaining} bn={bn} />
            </div>
          </section>

          {/* Your position (or a play CTA) */}
          {me ? (
            <YourPosition me={me} bn={bn} />
          ) : showPlayCta ? (
            <PlayCta authed={authed} bn={bn} />
          ) : null}

          {/* Prize table */}
          {tournament.prizes.length > 0 ? <PrizeTable prizes={tournament.prizes} bn={bn} /> : null}

          {/* Standings */}
          <StandingsTable rows={tournament.standings} bn={bn} />

          {/* Tiebreak transparency */}
          <p className="flex items-start gap-2 rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-ink-lo">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-300/70" />
            <span>
              {bn
                ? 'র‍্যাঙ্কিং মোট বাজির (WinGo) পরিমাণ অনুসারে। সমান স্কোর হলে যিনি আগে খেলা শুরু করেছেন তিনি এগিয়ে থাকেন। টুর্নামেন্ট শেষ হলে পুরস্কার স্বয়ংক্রিয়ভাবে বিজয়ীর মূল ব্যালেন্সে যোগ হয়।'
                : 'Ranking is by total WinGo wagered. Ties are broken by earliest activity first, so the player who started earlier ranks higher. Prizes are paid automatically to each winner main balance when the tournament ends.'}
            </span>
          </p>
        </div>
      )}
    </div>
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
          {bn ? 'লাইভ স্ট্যান্ডিং' : 'Live standings'}
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

// ---------- Empty state ----------

function EmptyState({ bn }: { bn: boolean }) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-gold-500/20 bg-[radial-gradient(120%_140%_at_15%_0%,#16110a_0%,#0b0e14_55%,#070a0f_100%)] px-6 py-12 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-14 h-52 w-52 rounded-full bg-[radial-gradient(circle,rgba(245,208,97,0.18),transparent_65%)]"
      />
      <div className="relative mx-auto flex max-w-sm flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gold-500/30 bg-gold-500/10 text-gold-300">
          <Trophy className="h-8 w-8" />
        </div>
        <h1 className="mt-4 font-en text-xl font-extrabold text-ink-hi">
          {bn ? 'এখন কোনো সক্রিয় টুর্নামেন্ট নেই' : 'No active tournament'}
        </h1>
        <p className="mt-2 text-sm text-ink-mid">
          {bn
            ? 'নতুন WinGo টুর্নামেন্ট শীঘ্রই আসছে। ততক্ষণে WinGo খেলুন এবং প্রস্তুত থাকুন।'
            : 'A new WinGo tournament is coming soon. Play WinGo in the meantime and be ready to climb.'}
        </p>
        <Link
          href="/games/wingo"
          className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-xl bg-grad-gold px-5 text-sm font-extrabold uppercase tracking-wider text-[#2a1c00] shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300 motion-safe:active:scale-95"
        >
          {bn ? 'WinGo খেলুন' : 'Play WinGo'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
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
