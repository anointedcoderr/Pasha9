// Built by Anointed Coder.
//
// Honest placeholder for external / API provider games. We do NOT
// fake a provider connection: every card surfaces as "Awaiting
// credentials" and the section copy makes clear external provider
// games will only appear once provider API keys are supplied.
//
// Used on the homepage and /games lobby to set client + player
// expectations while the platform's external-provider adapter layer
// remains dormant.

'use client';

import Link from 'next/link';
import { Plug, ArrowRight, Lock } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';
import { CategoryHeroArt, type CategoryCode } from './CategoryHeroArt';

interface SlotItem {
  code: CategoryCode;
  labelEn: string;
  labelBn: string;
}

const PROVIDER_SLOTS: SlotItem[] = [
  { code: 'slots',      labelEn: 'Provider Slots',      labelBn: 'প্রোভাইডার স্লট' },
  { code: 'liveCasino', labelEn: 'Provider Live Casino', labelBn: 'প্রোভাইডার লাইভ ক্যাসিনো' },
  { code: 'fishing',    labelEn: 'Provider Fishing',     labelBn: 'প্রোভাইডার ফিশিং' },
  { code: 'crash',      labelEn: 'Provider Crash',       labelBn: 'প্রোভাইডার ক্র্যাশ' },
  { code: 'tableGames', labelEn: 'Provider Table Games', labelBn: 'প্রোভাইডার টেবিল গেমস' },
];

interface Props {
  /** When true, surface an "Open Integrations" link to /admin/integrations. */
  showAdminLink?: boolean;
}

export function ProviderGamesSection({ showAdminLink = false }: Props) {
  const { lang } = useLang();

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-gradient-to-b from-slate-700 to-slate-900 text-amber-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
            <Plug className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-extrabold text-brand-ink md:text-xl">
              {lang === 'bn' ? 'প্রোভাইডার গেমস' : 'Provider Games'}
            </h2>
            <p className="text-xs text-brand-inkMute">
              {lang === 'bn'
                ? 'এক্সটার্নাল প্রোভাইডার গেমস প্রোভাইডার ক্রেডেনশিয়াল কানেক্ট হলে এখানে দেখা যাবে।'
                : 'External provider games will appear here after provider credentials are connected.'}
            </p>
          </div>
        </div>
        {showAdminLink ? (
          <Link
            href="/admin/integrations"
            className="hidden h-9 items-center gap-1 rounded-full border border-brand-divider bg-brand-paper px-3 text-xs font-bold uppercase tracking-wider text-brand-ink transition hover:border-brand-yellow-500 hover:bg-brand-surface md:inline-flex"
          >
            {lang === 'bn' ? 'অ্যাডমিন প্রোভাইডার' : 'Admin Providers'}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
        {PROVIDER_SLOTS.map((p) => (
          <div
            key={p.code}
            aria-disabled
            className={cn(
              'group relative overflow-hidden rounded-2xl border border-white/10 bg-brand-ink text-white shadow-[0_8px_24px_-12px_rgba(0,0,0,0.55)]',
              'cursor-not-allowed opacity-90',
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden">
              <CategoryHeroArt code={p.code} className="absolute inset-0 h-full w-full opacity-65" />
              <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-brand-ink/95 via-brand-ink/40 to-transparent" />
              <span className="absolute left-2 top-2 inline-flex h-5 items-center rounded-full border border-amber-300/60 bg-amber-200/15 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-100 backdrop-blur">
                {lang === 'bn' ? 'প্রোভাইডার' : 'Provider'}
              </span>
            </div>
            <div className="relative -mt-7 px-3 pb-3 pt-0">
              <h3 className="truncate text-sm font-extrabold leading-tight text-white">
                {lang === 'bn' ? p.labelBn : p.labelEn}
              </h3>
              <p className="mt-1 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/5 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/75">
                <Lock className="h-2.5 w-2.5" />
                {lang === 'bn' ? 'ক্রেডেনশিয়াল প্রতীক্ষায়' : 'Awaiting credentials'}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-brand-inkMute">
        {lang === 'bn'
          ? 'প্রোভাইডার API কী এবং কলব্যাক ডকুমেন্টেশন সরবরাহ করা হলে এই প্ল্যাটফর্মের প্রোভাইডার অ্যাডাপ্টার লেয়ার দিয়ে এক্সটার্নাল গেম প্রোভাইডার কানেক্ট করা যাবে।'
          : 'Once provider API keys and callback documentation are supplied, this platform can connect external game providers through the provider adapter layer.'}
      </p>
    </section>
  );
}
