// Built by Anointed Coder.
//
// Premium chrome shared by every Pasha Native Games play page.
// Each game still owns its play area + bet card; this shell wraps
// them with consistent header, wallet badge, fairness drawer, rules
// modal, error/loading/login states and a glowy casino background.

'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { ArrowLeft, ShieldCheck, Info, Wallet as WalletIcon, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatBDT } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { GameArt } from './GameArt';
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

export function GameShell({ code, titleEn, titleBn, taglineEn, taglineBn, accent = 'royal', ng, rules, children }: Props) {
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

      {/* Game art ribbon: a thin glossy banner under the topbar with the
          game's signature artwork on the right + title block on the left.
          Keeps the page rooted in its game identity without taking the
          whole hero. */}
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 px-5 py-4 backdrop-blur md:px-7 md:py-5">
        <div aria-hidden className="absolute inset-y-0 right-0 w-2/3 opacity-50">
          <GameArt code={code} className="h-full w-full" />
        </div>
        <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-transparent" />
        <div className="relative flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
              {lang === 'bn' ? 'পাশা অরিজিনাল' : 'Pasha Original'}
            </p>
            <h1 className="mt-0.5 text-2xl font-extrabold leading-tight text-white md:text-3xl">{title}</h1>
            {tagline ? <p className="mt-1 max-w-md text-xs text-white/75 md:text-sm">{tagline}</p> : null}
          </div>
          <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 text-[11px] font-bold uppercase tracking-wider text-emerald-200 md:inline-flex">
            <Sparkles className="h-3.5 w-3.5" />
            {lang === 'bn' ? 'প্রভাবলি ফেয়ার' : 'Provably Fair'}
          </span>
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
