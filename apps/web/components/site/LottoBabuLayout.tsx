// Built by Anointed Coder.
//
// Babu88-style flat layout for the /lotto page. Replaces the premium
// Cinzel + ball-tumbler + certificate stack with a conventional
// tabular layout the client signed off on:
//
//   Winner of the Day {date}
//   1st / 2nd / 3rd Prize cards (yellow)
//   Special     (black header + 5x2 number grid)
//   Consolation (black header + 5x2 number grid)
//   Next Draw Starts In   00:00:00
//   Earn Tickets          (yellow CTA)
//   My Winnings + Claim
//   Lifetime Winnings
//   Active Tickets | Last Draw Winning Tickets
//   How to earn tickets?
//   Brand Ambassadors
//   Sponsorships
//
// Pure presentation; all data fetching stays on the parent page.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { formatBDT } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';

// ---------- helpers ----------

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function splitToHHMMSS(drawsAt: string | null): { hh: string; mm: string; ss: string; expired: boolean } {
  if (!drawsAt) return { hh: '--', mm: '--', ss: '--', expired: true };
  const ms = new Date(drawsAt).getTime() - Date.now();
  if (ms <= 0) return { hh: '00', mm: '00', ss: '00', expired: true };
  const total = Math.floor(ms / 1000);
  return {
    hh: pad(Math.floor(total / 3600)),
    mm: pad(Math.floor((total % 3600) / 60)),
    ss: pad(total % 60),
    expired: false,
  };
}

function formatWinnerDate(input: string | Date | null): string {
  const d = input ? new Date(input) : new Date();
  const day = d.getDate();
  const month = d.getMonth() + 1;
  return `${day}/${month}`;
}

// ---------- prize cards ----------

interface PrizeCardProps {
  label: string;
  number: string | null;
  tone: 'gold' | 'amber' | 'sand';
}

function PrizeCard({ label, number, tone }: PrizeCardProps) {
  const labelBg = tone === 'gold'
    ? 'bg-[linear-gradient(180deg,#f5b400_0%,#d89e00_100%)]'
    : tone === 'amber'
      ? 'bg-[linear-gradient(180deg,#f5c649_0%,#e0a922_100%)]'
      : 'bg-[linear-gradient(180deg,#f9dd9b_0%,#e7c269_100%)]';
  return (
    <div className="flex flex-col items-stretch overflow-hidden rounded-xl border border-brand-divider bg-brand-paper">
      <div className={cn('px-2 py-2 text-center text-sm font-bold uppercase tracking-wider text-brand-ink', labelBg)}>
        {label}
      </div>
      <div className="flex items-center justify-center px-2 py-3 sm:py-4">
        <span className="font-bold tabular-nums text-brand-ink text-3xl sm:text-4xl">
          {number ?? '----'}
        </span>
      </div>
    </div>
  );
}

// ---------- number grid (Special / Consolation) ----------

function NumberGrid({ title, numbers }: { title: string; numbers: string[] }) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-divider bg-brand-paper">
      <div className="bg-[#15171c] px-3 py-2 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-white">{title}</p>
      </div>
      {numbers.length === 0 ? (
        <p className="px-3 py-6 text-center text-xs text-brand-inkMute">No numbers yet.</p>
      ) : (
        <div className="grid grid-cols-5 gap-1 px-2 py-3 text-center sm:px-3 sm:py-4">
          {numbers.slice(0, 10).map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="font-bold tabular-nums text-brand-ink text-base sm:text-lg"
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- countdown ----------

function Countdown({ drawsAt }: { drawsAt: string | null }) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [time, setTime] = useState(() => splitToHHMMSS(drawsAt));

  useEffect(() => {
    setTime(splitToHHMMSS(drawsAt));
    const id = window.setInterval(() => setTime(splitToHHMMSS(drawsAt)), 1000);
    return () => window.clearInterval(id);
  }, [drawsAt]);

  return (
    <section className="rounded-xl border border-brand-divider bg-brand-paper px-4 py-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-inkSoft">
        {bn ? 'পরবর্তী ড্র শুরু হবে' : 'Next Draw Starts In'}
      </p>
      <p className="mt-2 inline-flex items-baseline gap-2 text-4xl font-extrabold tabular-nums text-brand-ink sm:text-5xl">
        <span>{time.hh}</span>
        <span className="text-brand-inkMute">:</span>
        <span>{time.mm}</span>
        <span className="text-brand-inkMute">:</span>
        <span>{time.ss}</span>
      </p>
    </section>
  );
}

// ---------- CTAs and stat cards ----------

function EarnTicketsCta() {
  const { lang } = useLang();
  return (
    <Link
      href="/deposit"
      className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[linear-gradient(180deg,#fbc417_0%,#e9a40d_100%)] text-base font-bold text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_8px_18px_-10px_rgba(245,180,0,0.7)] transition active:translate-y-px"
    >
      {lang === 'bn' ? 'টিকিট অর্জন করুন' : 'Earn Tickets'}
    </Link>
  );
}

interface WinningsProps {
  pendingTotal: number;
  hasClaimable: boolean;
  onClaim?: () => void;
  busy?: boolean;
}

function MyWinningsRow({ pendingTotal, hasClaimable, onClaim, busy }: WinningsProps) {
  const { lang } = useLang();
  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-brand-divider bg-brand-paper px-4 py-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-inkMute">
          {lang === 'bn' ? 'আমার জয়' : 'My Winnings'}:
        </p>
        <p className="mt-0.5 text-2xl font-extrabold tabular-nums text-brand-ink">
          {formatBDT(pendingTotal)}
        </p>
      </div>
      <button
        type="button"
        onClick={onClaim}
        disabled={!hasClaimable || busy}
        className={cn(
          'inline-flex h-11 items-center rounded-lg px-5 text-sm font-bold transition',
          hasClaimable
            ? 'bg-[linear-gradient(180deg,#fbc417_0%,#e9a40d_100%)] text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] active:translate-y-px'
            : 'cursor-not-allowed bg-brand-surface text-brand-inkMute',
        )}
      >
        {busy ? (lang === 'bn' ? 'প্রক্রিয়া...' : 'Working...') : (lang === 'bn' ? 'দাবি' : 'Claim')}
      </button>
    </section>
  );
}

function LifetimeWinningsRow({ total }: { total: number }) {
  const { lang } = useLang();
  return (
    <section className="flex items-center justify-between gap-3 rounded-xl border border-brand-divider bg-brand-paper px-4 py-3">
      <p className="text-sm font-semibold text-brand-ink">
        {lang === 'bn' ? 'লাইফটাইম জয়' : 'Lifetime Winnings'}
      </p>
      <p className="text-2xl font-extrabold tabular-nums text-brand-ink">{formatBDT(total)}</p>
    </section>
  );
}

function TicketStats({ active, lastDrawWinning }: { active: number; lastDrawWinning: number }) {
  const { lang } = useLang();
  return (
    <section className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-brand-divider bg-brand-paper px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-inkMute">
          {lang === 'bn' ? 'অ্যাক্টিভ টিকিট' : 'Active Tickets'}:
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-500">{active}</p>
      </div>
      <div className="rounded-xl border border-brand-divider bg-brand-paper px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-inkMute">
          {lang === 'bn' ? 'গত ড্রয়ের জিতা টিকিট' : 'Last Draw Winning Tickets'}:
        </p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-ink">{lastDrawWinning}</p>
      </div>
    </section>
  );
}

function HowToEarnLink() {
  const { lang } = useLang();
  return (
    <Link
      href="/lotto/my-tickets"
      className="inline-flex items-center gap-1 text-sm font-bold text-brand-ink hover:text-brand-yellow-700"
    >
      {lang === 'bn' ? 'টিকিট কীভাবে অর্জন করবেন?' : 'How to earn tickets?'}
      <ChevronRight className="h-4 w-4" />
    </Link>
  );
}

// ---------- Ambassadors + Sponsors ----------

export interface AmbassadorRow {
  id: string;
  nameEn: string;
  nameBn: string | null;
  iconUrl: string | null;
  subtitle: string | null;
}

function AmbassadorList({ rows }: { rows: AmbassadorRow[] }) {
  const { lang } = useLang();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-brand-divider bg-[#0F1115] px-4 py-5 text-white">
      <h3 className="text-base font-extrabold text-brand-yellow-400">
        {lang === 'bn' ? 'ব্র্যান্ড অ্যাম্বাসেডর' : 'Brand Ambassadors'}
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const name = lang === 'bn' && row.nameBn ? row.nameBn : row.nameEn;
          return (
            <li key={row.id} className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
                {row.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.iconUrl} alt={name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-base font-bold text-brand-yellow-300">{name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{name}</p>
                {row.subtitle ? (
                  <p className="truncate text-xs text-white/70">{row.subtitle}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SponsorList({ rows }: { rows: AmbassadorRow[] }) {
  const { lang } = useLang();
  if (rows.length === 0) return null;
  return (
    <section className="rounded-xl border border-brand-divider bg-[#0F1115] px-4 py-5 text-white">
      <h3 className="text-base font-extrabold text-brand-yellow-400">
        {lang === 'bn' ? 'স্পনসরশিপ' : 'Sponsorships'}
      </h3>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {rows.map((row) => {
          const name = lang === 'bn' && row.nameBn ? row.nameBn : row.nameEn;
          return (
            <li key={row.id} className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
                {row.iconUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.iconUrl} alt={name} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-base font-bold text-brand-yellow-300">{name.charAt(0)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{name}</p>
                {row.subtitle ? (
                  <p className="truncate text-xs text-white/70">{row.subtitle}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- Public layout ----------

export interface LottoBabuLayoutProps {
  /** Latest published draw (top of results). */
  latest: {
    drawName: string;
    publishedAt: string;
    winningNumber: string;
    second: string | null;
    third: string | null;
    specials: string[];
    consolations: string[];
  } | null;
  /** Next live draw the public clock targets. */
  nextDrawAt: string | null;
  /** Logged-in player summary, or null when not signed in. */
  me: {
    activeTickets: number;
    lastDrawWinningTickets: number;
    pendingClaimTotal: number;
    lifetimeWinnings: number;
    hasClaimable: boolean;
  } | null;
  /** Public ambassador rows for the bottom section. */
  ambassadors: AmbassadorRow[];
  /** Public sponsor rows for the bottom section. */
  sponsors: AmbassadorRow[];
  /** Claim button handler. Optional; CTA disables when not provided. */
  onClaim?: () => void;
  /** Whether the claim button is processing. */
  claimBusy?: boolean;
}

export function LottoBabuLayout({
  latest, nextDrawAt, me, ambassadors, sponsors, onClaim, claimBusy,
}: LottoBabuLayoutProps) {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const dateLabel = latest ? formatWinnerDate(latest.publishedAt) : formatWinnerDate(null);

  return (
    <div className="space-y-3">
      {/* Winner of the Day header */}
      <h2 className="text-lg font-extrabold text-brand-ink">
        {bn ? `দিনের বিজয়ী ${dateLabel}` : `Winner of the Day ${dateLabel}`}
      </h2>

      {/* 1st / 2nd / 3rd prizes */}
      <section className="grid grid-cols-3 gap-2">
        <PrizeCard
          label={bn ? '1ম পুরস্কার' : '1st Prize'}
          number={latest?.winningNumber ?? null}
          tone="gold"
        />
        <PrizeCard
          label={bn ? '2য় পুরস্কার' : '2nd Prize'}
          number={latest?.second ?? null}
          tone="amber"
        />
        <PrizeCard
          label={bn ? '3য় পুরস্কার' : '3rd Prize'}
          number={latest?.third ?? null}
          tone="sand"
        />
      </section>

      {/* Special + Consolation grids */}
      <NumberGrid
        title={bn ? 'বিশেষ' : 'Special'}
        numbers={latest?.specials ?? []}
      />
      <NumberGrid
        title={bn ? 'সান্ত্বনা' : 'Consolation'}
        numbers={latest?.consolations ?? []}
      />

      {/* Countdown to next draw */}
      <Countdown drawsAt={nextDrawAt} />

      {/* Earn Tickets CTA */}
      <EarnTicketsCta />

      {/* Per-user blocks (only when signed in). Guests get a hint. */}
      {me ? (
        <>
          <MyWinningsRow
            pendingTotal={me.pendingClaimTotal}
            hasClaimable={me.hasClaimable}
            onClaim={onClaim}
            busy={claimBusy}
          />
          <LifetimeWinningsRow total={me.lifetimeWinnings} />
          <TicketStats active={me.activeTickets} lastDrawWinning={me.lastDrawWinningTickets} />
          <HowToEarnLink />
        </>
      ) : (
        <section className="rounded-xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {bn
            ? 'টিকেট এবং পুরস্কার দেখতে লগইন করুন।'
            : 'Sign in to see your tickets, winnings and claim balance.'}
        </section>
      )}

      {/* Brand Ambassadors + Sponsorships at the bottom */}
      <AmbassadorList rows={ambassadors} />
      <SponsorList rows={sponsors} />
    </div>
  );
}
