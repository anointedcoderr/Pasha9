// Built by Anointed Coder.
// Three-step quick action strip: Register, Deposit, Play.
// Sits below the hero on the homepage. Adapts copy by language.

'use client';

import Link from 'next/link';
import { UserPlus, ArrowDownToLine, Gamepad2, ArrowRight } from 'lucide-react';
import { useT } from '@/lib/i18n/context';

interface Step {
  key: 'register' | 'deposit' | 'play';
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const STEPS: Step[] = [
  { key: 'register', icon: UserPlus, href: '/?signup=1' },
  { key: 'deposit', icon: ArrowDownToLine, href: '/deposit' },
  { key: 'play', icon: Gamepad2, href: '/games' },
];

export function QuickActionStrip() {
  const t = useT();
  return (
    <section className="card-light p-4 md:p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex items-stretch gap-3 md:flex-1">
              <Link
                href={step.href}
                className="group flex flex-1 items-center gap-3 rounded-xl border border-brand-divider bg-brand-surface px-4 py-3 transition hover:border-brand-yellow-500 hover:bg-brand-paper"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-grad-yellow text-brand-ink shadow-[0_4px_10px_-6px_rgba(245,180,0,0.6)]">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-inkMute">
                    {t(`home.qa.${step.key}Step`)}
                  </p>
                  <p className="truncate text-sm font-bold text-brand-ink">
                    {t(`home.qa.${step.key}Title`)}
                  </p>
                </span>
              </Link>
              {i < STEPS.length - 1 ? (
                <span className="hidden items-center justify-center text-brand-inkMute md:flex" aria-hidden>
                  <ArrowRight className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
