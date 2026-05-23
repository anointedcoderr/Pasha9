// Built by Anointed Coder.
// Lightweight back + home strip for internal public pages. Users tap the
// arrow to step back through history (router.back), tap the title or Home
// chip to return to the landing page. Drops onto the very top of an
// internal page above its hero so the visitor never feels trapped on a
// promo / lotto / referral / FAQ surface.

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface Props {
  title?: string;
  /** Optional override for the back action. Defaults to router.back() with home fallback. */
  onBack?: () => void;
  /** If true the back button is replaced by a Home link only (use on top-level entry pages). */
  homeOnly?: boolean;
}

export function BackBar({ title, onBack, homeOnly }: Props) {
  const router = useRouter();
  const { lang } = useLang();

  const handleBack = () => {
    if (onBack) return onBack();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }
    router.push('/');
  };

  return (
    <div className="-mx-3 mb-3 flex items-center gap-2 border-b border-brand-divider bg-brand-paper px-3 py-2 md:mx-0 md:rounded-xl md:border md:px-3">
      {!homeOnly ? (
        <button
          type="button"
          onClick={handleBack}
          aria-label={lang === 'bn' ? 'পেছনে' : 'Back'}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-brand-ink transition hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
      ) : null}
      <Link
        href="/"
        aria-label={lang === 'bn' ? 'হোম' : 'Home'}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] font-semibold text-brand-inkSoft transition hover:bg-brand-surface hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40"
      >
        <Home className="h-4 w-4 text-brand-yellow-600" />
        <span>{lang === 'bn' ? 'হোম' : 'Home'}</span>
      </Link>
      {title ? (
        <>
          <span aria-hidden className="text-brand-inkMute">/</span>
          <span className="truncate text-[13px] font-bold text-brand-ink">{title}</span>
        </>
      ) : null}
    </div>
  );
}
