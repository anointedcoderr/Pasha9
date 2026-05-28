// Built by Anointed Coder.
//
// Premium chrome shared by every Pasha Native Games play page.
// Each game still owns its play area + bet card; this shell wraps
// them with consistent header, wallet badge, fairness drawer, rules
// modal, error/loading/login states and a glowy casino background.

'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowLeft, ShieldCheck, Info, Wallet as WalletIcon, Sparkles, Zap, ArrowDownCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatBDT } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { GameArt } from './GameArt';
import { HeroArt } from './HeroArt';
import { FairnessDrawer } from './FairnessDrawer';
import { RulesModal } from './RulesModal';
import type { UseNativeGameResult } from '@/lib/native-games/use-native-game';

type ArtCode = 'dice' | 'mines' | 'keno' | 'roulette' | 'slots' | 'crash';

interface Props {
  code: ArtCode;
  titleEn: string;
  titleBn: string;
  taglineEn?: string;
  taglineBn?: string;
  // Per-game call-to-action label rendered in the hero ribbon.
  // Examples: "Roll the Dice", "Reveal Tiles", "Pick Your Luck",
  // "Spin the Wheel", "Pull the Lever", "Start Round".
  ctaLabelEn?: string;
  ctaLabelBn?: string;
  accent?: 'gold' | 'royal' | 'red' | 'emerald' | 'sapphire' | 'amber';
  ng: UseNativeGameResult;
  rules: ReactNode;            // shown inside the rules modal
  children: ReactNode;         // the game-specific play area + bet card
}

const ACCENT_BG: Record<NonNullable<Props['accent']>, string> = {
  gold:     'from-amber-950 via-[#1a0d2a] to-black',
  royal:    'from-indigo-950 via-[#1a0d2a] to-black',
  red:      'from-rose-950 via-[#1a0608] to-black',
  emerald:  'from-emerald-950 via-[#0A2618] to-black',
  sapphire: 'from-blue-950 via-[#040A1F] to-black',
  amber:    'from-orange-950 via-[#27160B] to-black',
};

// Distinct hero-ribbon gradient per game accent. Picked richer than
// the outer frame so the hero stands out without the rest of the
// page going dark.
const ACCENT_HERO_BG: Record<NonNullable<Props['accent']>, string> = {
  gold:     'from-[#1a0d2a] via-[#2a1335] to-[#3a1500]',
  royal:    'from-[#1a0d2a] via-[#2a1062] to-[#101030]',
  red:      'from-[#260714] via-[#480818] to-[#1a0608]',
  emerald:  'from-[#08231a] via-[#0e4634] to-[#06120e]',
  sapphire: 'from-[#0a1640] via-[#102a72] to-[#04060f]',
  amber:    'from-[#3a1f08] via-[#5a330e] to-[#1a0a06]',
};

export function GameShell({ code, titleEn, titleBn, taglineEn, taglineBn, ctaLabelEn, ctaLabelBn, accent = 'royal', ng, rules, children }: Props) {
  const { lang } = useLang();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [fairnessOpen, setFairnessOpen] = useState(false);

  const title = lang === 'bn' ? titleBn : titleEn;
  const tagline = lang === 'bn' ? taglineBn : taglineEn;

  // Login gate replaces the whole shell with a centered CTA.
  if (ng.authError) {
    return (
      <Frame accent={accent}>
        <TopBar lang={lang} title={title} onRules={() => setRulesOpen(true)} onFairness={() => setFairnessOpen(true)} canFairness={false} canRules />
        <Centerpiece>
          <p className="text-sm text-white/85">{lang === 'bn' ? 'খেলতে লগইন করুন।' : 'Log in to play.'}</p>
          <div className="mt-4 flex gap-2">
            <Link href="/?login=1" className="inline-flex h-10 items-center rounded-lg bg-brand-yellow-500 px-5 text-sm font-extrabold uppercase tracking-wider text-brand-ink hover:brightness-105">
              {lang === 'bn' ? 'লগইন' : 'Log in'}
            </Link>
            <Link href="/?signup=1" className="inline-flex h-10 items-center rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10">
              {lang === 'bn' ? 'রেজিস্টার' : 'Register'}
            </Link>
          </div>
        </Centerpiece>
        <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} title={title}>{rules}</RulesModal>
      </Frame>
    );
  }

  // Game not yet loaded - show a soft skeleton instead of an empty page.
  if (!ng.game) {
    return (
      <Frame accent={accent}>
        <TopBar lang={lang} title={title} onRules={() => setRulesOpen(true)} onFairness={() => setFairnessOpen(true)} canFairness={false} canRules />
        <Centerpiece>
          <div className="h-12 w-40 rounded-lg bg-white/10" />
          <p className="mt-3 text-xs text-white/60">{lang === 'bn' ? 'গেম লোড হচ্ছে...' : 'Loading game...'}</p>
        </Centerpiece>
        <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} title={title}>{rules}</RulesModal>
      </Frame>
    );
  }

  // Game inactive or global flag off - premium unavailable screen.
  if (!ng.enabled || !ng.game.isActive) {
    return (
      <Frame accent={accent}>
        <TopBar lang={lang} title={title} onRules={() => setRulesOpen(true)} onFairness={() => setFairnessOpen(true)} canFairness={false} canRules />
        <Centerpiece>
          <GameArt code={code} className="mx-auto w-72 max-w-full rounded-2xl shadow-2xl ring-1 ring-white/10" />
          <p className="mt-5 text-xs font-bold uppercase tracking-wider text-amber-200">
            {lang === 'bn' ? 'শীঘ্রই আসছে' : 'Coming soon'}
          </p>
          <p className="mt-2 text-sm text-white/85">
            {lang === 'bn'
              ? 'এই গেমটি এখন সাময়িকভাবে অনুপলব্ধ। অ্যাডমিন ওয়ালেট টেস্ট শেষ হলে চালু হবে।'
              : 'This game is temporarily unavailable. It will go live after admin wallet testing.'}
          </p>
          <Link href="/games" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg border border-white/30 bg-white/5 px-5 text-sm font-bold uppercase tracking-wider text-white hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" />
            {lang === 'bn' ? 'গেমে ফিরুন' : 'Back to games'}
          </Link>
        </Centerpiece>
        <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} title={title}>{rules}</RulesModal>
      </Frame>
    );
  }

  return (
    <Frame accent={accent}>
      <TopBar
        lang={lang}
        title={title}
        balance={ng.balance}
        onRules={() => setRulesOpen(true)}
        onFairness={() => setFairnessOpen(true)}
        canRules
        canFairness={Boolean(ng.session)}
      />

      {/* Game hero ribbon. Two-column composition on every breakpoint:
          - left: kicker / title / tagline / chips stack / per-game CTA pill
          - right: HeroArt foreground composition with ambient glow
          Mobile compresses the art to ~36% width but keeps it visible so
          the page reads as "a real game" the moment it loads. */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#0a0613] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_60px_-30px_rgba(0,0,0,0.65)]">
        {/* Layered background: deep gradient + radial spotlight tied to accent + hairline gold rule */}
        <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br opacity-90', ACCENT_HERO_BG[accent])} />
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_75%_30%,rgba(255,213,84,0.18),transparent_55%)]" />
        <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />
        <div aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-amber-300/25 to-transparent" />

        <div className="relative grid grid-cols-[1fr_125px] items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_180px] sm:gap-5 sm:px-5 sm:py-5 md:grid-cols-[1.2fr_1fr] md:gap-6 md:px-7 md:py-7">
          {/* Left: copy + chips + CTA */}
          <div className="min-w-0 png-fade-up">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
              <Sparkles className="h-3 w-3" />
              {lang === 'bn' ? 'পাশা অরিজিনাল' : 'Pasha Original'}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold leading-[1.05] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] sm:text-3xl md:text-4xl">
              {title}
            </h1>
            {tagline ? (
              <p className="mt-2 max-w-md text-xs font-medium text-white/90 sm:text-sm">
                {tagline}
              </p>
            ) : null}

            {/* Premium chip stack */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <HeroBadge tone="emerald" icon={<ShieldCheck className="h-3 w-3" />}>
                {lang === 'bn' ? 'প্রভাবলি ফেয়ার' : 'Provably Fair'}
              </HeroBadge>
              <HeroBadge tone="gold" icon={<Zap className="h-3 w-3" />}>
                {lang === 'bn' ? 'ইনস্ট্যান্ট প্লে' : 'Instant Play'}
              </HeroBadge>
              <HeroBadge tone="sky" icon={<WalletIcon className="h-3 w-3" />}>
                {lang === 'bn' ? 'ওয়ালেট কানেক্টেড' : 'Wallet Connected'}
              </HeroBadge>
              {ng.game ? (
                <>
                  <HeroBadge tone="bone">
                    {lang === 'bn' ? 'মিন' : 'Min'}: {formatBDT(Number(ng.game.minBet))}
                  </HeroBadge>
                  <HeroBadge tone="bone">
                    {lang === 'bn' ? 'ম্যাক্স' : 'Max'}: {formatBDT(Number(ng.game.maxBet))}
                  </HeroBadge>
                </>
              ) : null}
            </div>

            {/* CTA pill: anchor scrolls to the bet card */}
            {ctaLabelEn || ctaLabelBn ? (
              <a
                href="#png-bet"
                className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_22px_-10px_rgba(245,180,0,0.7)] transition hover:brightness-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 active:translate-y-px"
              >
                <ArrowDownCircle className="h-4 w-4" />
                {lang === 'bn' ? (ctaLabelBn ?? ctaLabelEn ?? '') : (ctaLabelEn ?? ctaLabelBn ?? '')}
              </a>
            ) : null}
          </div>

          {/* Right: per-game hero illustration */}
          <div className="relative h-32 sm:h-40 md:h-48">
            <HeroArt code={code} className="absolute inset-0 h-full w-full drop-shadow-[0_18px_24px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      </section>

      {ng.loadError ? (
        <p className="rounded-lg border border-red-400/40 bg-red-500/10 px-4 py-2 text-sm text-red-200">{ng.loadError}</p>
      ) : null}

      {children}

      {/* Bottom padding so the mobile sticky bar in each game does not
          cover the last content card. */}
      <div className="h-24 md:h-2" />

      <FairnessDrawer open={fairnessOpen} onOpenChange={setFairnessOpen} ng={ng} />
      <RulesModal open={rulesOpen} onOpenChange={setRulesOpen} title={title}>
        {rules}
      </RulesModal>
    </Frame>
  );
}

// ---------- Inner pieces ----------

function Frame({ accent, children }: { accent: NonNullable<Props['accent']>; children: ReactNode }) {
  return (
    <div className={cn('relative min-h-[calc(100vh-200px)] -mt-2 rounded-3xl border border-white/5 bg-gradient-to-b text-white shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]', ACCENT_BG[accent])}>
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
        <div className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute right-0 top-1/3 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-64 w-72 rounded-full bg-sky-500/10 blur-3xl" />
      </div>
      <div className="relative space-y-4 p-3 md:space-y-5 md:p-6">{children}</div>
    </div>
  );
}

function TopBar({
  lang, title, balance, onRules, onFairness, canRules, canFairness,
}: { lang: 'bn' | 'en'; title: string; balance?: number | null; onRules: () => void; onFairness: () => void; canRules: boolean; canFairness: boolean }) {
  return (
    <header className="flex items-center justify-between gap-2">
      <Link href="/games" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60">
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{lang === 'bn' ? 'গেমে ফিরুন' : 'Back to games'}</span>
        <span className="sm:hidden">{lang === 'bn' ? 'গেম' : 'Games'}</span>
      </Link>

      <div className="flex items-center gap-2">
        {typeof balance === 'number' ? (
          <span className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 text-sm font-extrabold tabular-nums text-amber-100">
            <WalletIcon className="h-3.5 w-3.5 text-amber-300" />
            {formatBDT(balance)}
          </span>
        ) : null}
        {canRules ? (
          <button type="button" onClick={onRules} aria-label="Rules" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/5 text-white hover:border-white/30 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60">
            <Info className="h-4 w-4" />
          </button>
        ) : null}
        {canFairness ? (
          <button type="button" onClick={onFairness} aria-label="Provably fair" className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-100 hover:border-emerald-300/60 hover:bg-emerald-400/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === 'bn' ? 'প্রভাবলি ফেয়ার' : 'Provably fair'}</span>
            <span className="sm:hidden">{lang === 'bn' ? 'ফেয়ার' : 'Fair'}</span>
          </button>
        ) : null}
      </div>
    </header>
  );
}

function Centerpiece({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-[55vh] place-items-center rounded-2xl border border-white/10 bg-black/30 p-8 text-center">
      <div className="png-fade-up max-w-md">{children}</div>
    </div>
  );
}

// ---------- Convenience exports for game pages ----------

// Premium chip used in the hero ribbon. Distinct tones so the
// badge stack reads as ordered (status / capability / wallet / range)
// without going noisy.
function HeroBadge({ tone, icon, children }: { tone: 'gold' | 'emerald' | 'sky' | 'bone' | 'rose'; icon?: ReactNode; children: ReactNode }) {
  const map = {
    gold:    'border-amber-300/55 bg-gradient-to-b from-amber-300/25 to-amber-500/10 text-amber-100',
    emerald: 'border-emerald-300/55 bg-gradient-to-b from-emerald-400/25 to-emerald-600/10 text-emerald-100',
    sky:     'border-sky-300/55 bg-gradient-to-b from-sky-400/25 to-sky-600/10 text-sky-100',
    rose:    'border-rose-300/55 bg-gradient-to-b from-rose-400/25 to-rose-600/10 text-rose-100',
    bone:    'border-white/25 bg-white/10 text-white/90',
  } as const;
  return (
    <span className={cn('inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-bold uppercase tracking-wider backdrop-blur', map[tone])}>
      {icon}
      <span>{children}</span>
    </span>
  );
}

export function GamePanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-white/10 bg-black/35 p-4 backdrop-blur md:p-5', className)}>
      {children}
    </section>
  );
}

export function GamePanelTitle({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-sm font-bold uppercase tracking-[0.18em] text-amber-200">{children}</h2>
      {hint ? <span className="text-[10px] text-white/55">{hint}</span> : null}
    </div>
  );
}
