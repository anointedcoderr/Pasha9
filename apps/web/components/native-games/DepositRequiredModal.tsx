// Built by Anointed Coder.
//
// Premium "Deposit Required" modal. Triggered when a game bet
// would exceed wallet balance OR when the bet endpoint returns
// INSUFFICIENT_FUNDS. Content + background are admin-customizable
// via /api/content/deposit-prompt (SystemSetting backed).
//
// Renders on top of any game page without interfering with the
// underlying play surface. Closing the modal returns the user to
// the game; the Deposit Now CTA opens /deposit.

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { X, Wallet as WalletIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatBDT } from '@/lib/utils/format';
import { useLang } from '@/lib/i18n/context';
import { safeNumber, safeString } from '@/lib/native-games/safe';

interface Settings {
  titleEn: string;
  titleBn: string;
  messageEn: string;
  messageBn: string;
  ctaEn: string;
  ctaBn: string;
  bgType: 'gradient' | 'image';
  bgImageUrl: string;
  bgImageEnabled: boolean;
  accent: 'gold' | 'royal' | 'red' | 'emerald' | 'sapphire';
}

const FALLBACK: Settings = {
  titleEn: 'Deposit Required',
  titleBn: 'ডিপোজিট দরকার',
  messageEn: 'You need wallet balance to place this bet. Top up your wallet to keep playing.',
  messageBn: 'এই বেট দিতে ওয়ালেটে ব্যালেন্স দরকার। চালিয়ে যেতে ওয়ালেট টপ-আপ করুন।',
  ctaEn: 'Deposit Now',
  ctaBn: 'এখনই ডিপোজিট',
  bgType: 'gradient',
  bgImageUrl: '',
  bgImageEnabled: false,
  accent: 'gold',
};

const ACCENT_GRADIENT: Record<Settings['accent'], string> = {
  gold:     'from-[#3a1f08] via-[#5a330e] to-[#1a0a06]',
  royal:    'from-[#1a0d2a] via-[#2a1062] to-[#101030]',
  red:      'from-[#260714] via-[#480818] to-[#1a0608]',
  emerald:  'from-[#08231a] via-[#0e4634] to-[#06120e]',
  sapphire: 'from-[#0a1640] via-[#102a72] to-[#04060f]',
};

// Module-level cache so reopening the modal in the same session
// does not re-fetch. Cleared by a full page reload.
let cached: Settings | null = null;
let cachePromise: Promise<Settings> | null = null;

function normalize(raw: unknown): Settings {
  if (!raw || typeof raw !== 'object') return FALLBACK;
  const r = raw as Record<string, unknown>;
  const accentRaw = safeString(r.accent, FALLBACK.accent);
  const accent: Settings['accent'] = (['gold', 'royal', 'red', 'emerald', 'sapphire'] as const).includes(accentRaw as Settings['accent'])
    ? (accentRaw as Settings['accent'])
    : FALLBACK.accent;
  const bgTypeRaw = safeString(r.bgType, FALLBACK.bgType);
  const bgType: Settings['bgType'] = bgTypeRaw === 'image' ? 'image' : 'gradient';
  return {
    titleEn: safeString(r.titleEn, FALLBACK.titleEn) || FALLBACK.titleEn,
    titleBn: safeString(r.titleBn, FALLBACK.titleBn) || FALLBACK.titleBn,
    messageEn: safeString(r.messageEn, FALLBACK.messageEn) || FALLBACK.messageEn,
    messageBn: safeString(r.messageBn, FALLBACK.messageBn) || FALLBACK.messageBn,
    ctaEn: safeString(r.ctaEn, FALLBACK.ctaEn) || FALLBACK.ctaEn,
    ctaBn: safeString(r.ctaBn, FALLBACK.ctaBn) || FALLBACK.ctaBn,
    bgType,
    bgImageUrl: safeString(r.bgImageUrl, ''),
    bgImageEnabled: Boolean(r.bgImageEnabled),
    accent,
  };
}

async function fetchSettings(): Promise<Settings> {
  if (cached) return cached;
  if (cachePromise) return cachePromise;
  cachePromise = (async () => {
    try {
      const res = await fetch('/api/content/deposit-prompt', { cache: 'no-store' });
      if (!res.ok) return FALLBACK;
      const data = await res.json().catch(() => null);
      const merged = normalize(data);
      cached = merged;
      return merged;
    } catch {
      return FALLBACK;
    } finally {
      cachePromise = null;
    }
  })();
  return cachePromise;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  balance?: number | null;
  requiredAmount?: number | null;
}

export function DepositRequiredModal({ open, onOpenChange, balance, requiredAmount }: Props) {
  const { lang } = useLang();
  const [settings, setSettings] = useState<Settings>(cached ?? FALLBACK);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    fetchSettings()
      .then((s) => { if (alive) setSettings(s); })
      .catch(() => { if (alive) setSettings(FALLBACK); });
    return () => { alive = false; };
  }, [open]);

  // All renderable fields go through string fallbacks so a partial
  // settings record (or undefined keys from a misconfigured admin
  // write) cannot crash the modal.
  const title = (lang === 'bn' ? settings.titleBn : settings.titleEn) || FALLBACK.titleEn;
  const message = (lang === 'bn' ? settings.messageBn : settings.messageEn) || FALLBACK.messageEn;
  const cta = (lang === 'bn' ? settings.ctaBn : settings.ctaEn) || FALLBACK.ctaEn;

  const accent: Settings['accent'] = (settings.accent in ACCENT_GRADIENT ? settings.accent : 'gold') as Settings['accent'];
  const bgImageUrl = safeString(settings.bgImageUrl, '').trim();
  const useImage = Boolean(settings.bgImageEnabled) && settings.bgType === 'image' && bgImageUrl.length > 0 && !imgError;

  const balanceNumber = balance == null ? null : safeNumber(balance, 0);
  const requiredNumber = requiredAmount == null ? null : safeNumber(requiredAmount, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-[#0a0613] text-white shadow-[0_30px_80px_-30px_rgba(0,0,0,0.7)] outline-none"
        >
          {/* Background layer */}
          <div className="relative">
            <div aria-hidden className={cn('absolute inset-0 bg-gradient-to-br opacity-95', ACCENT_GRADIENT[accent])} />
            {useImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bgImageUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover opacity-55"
                onError={() => setImgError(true)}
              />
            ) : null}
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_25%,rgba(255,213,84,0.22),transparent_55%)]" />
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />

            <Dialog.Close
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/30 text-white/80 backdrop-blur hover:bg-black/50 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>

            <div className="relative px-6 pb-2 pt-7 text-center md:px-7 md:pt-8">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_10px_22px_-8px_rgba(245,180,0,0.6)]">
                <WalletIcon className="h-7 w-7" />
              </span>
              <Dialog.Title className="mt-3 text-xl font-extrabold leading-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.55)] md:text-2xl">
                {title}
              </Dialog.Title>
              <Dialog.Description className="mt-2 px-2 text-sm font-medium text-white/90">
                {message}
              </Dialog.Description>
            </div>
          </div>

          {/* Balance + required strip */}
          {(balanceNumber != null || requiredNumber != null) ? (
            <div className="relative grid grid-cols-2 gap-2 border-t border-white/10 bg-black/40 px-5 py-4 md:px-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{lang === 'bn' ? 'বর্তমান ব্যালেন্স' : 'Current balance'}</p>
                <p className="mt-0.5 text-base font-extrabold tabular-nums text-white">
                  {balanceNumber != null ? formatBDT(balanceNumber) : '-'}
                </p>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200/80">{lang === 'bn' ? 'প্রয়োজনীয়' : 'Required'}</p>
                <p className="mt-0.5 text-base font-extrabold tabular-nums text-amber-100">
                  {requiredNumber != null ? formatBDT(requiredNumber) : '-'}
                </p>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="relative flex flex-col gap-2 border-t border-white/10 bg-black/55 px-5 py-4 md:flex-row-reverse md:items-center md:justify-between md:px-6">
            <Link
              href="/deposit"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_18px_-8px_rgba(245,180,0,0.7)] transition hover:brightness-105 active:translate-y-px"
            >
              {cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 text-sm font-bold uppercase tracking-wider text-white/85 hover:bg-white/10"
            >
              {lang === 'bn' ? 'পরে দেখুন' : 'Keep Browsing'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// Helper for game pages: returns true if the error is a wallet
// insufficient-funds case the modal should handle. Used in catch
// handlers around the bet POST.
export function isInsufficientFundsError(payload: { code?: string; message?: string } | null | undefined): boolean {
  if (!payload) return false;
  if (payload.code === 'INSUFFICIENT_FUNDS') return true;
  if (payload.code === 'INSUFFICIENT_LOTTO_BALANCE') return true;
  const m = (payload.message ?? '').toLowerCase();
  return m.includes('insufficient') || m.includes('lower than');
}
