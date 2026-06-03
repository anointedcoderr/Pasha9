// Built by Anointed Coder.
//
// Babu88-style "selected method" detail panel. Used by /deposit and
// /withdraw after the user picks a payment method tile. Renders:
//   - Wide banner (bannerUrl) when admin uploaded one, otherwise a
//     coloured strip with the method name
//   - The account number / wallet number with a copy button
//   - Localised instructions (BN falls back to EN)
//
// All money fields come from the public payment-methods endpoint;
// nothing here decides which method is active - the parent owns
// selection state.

'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

export interface SelectedMethod {
  id: string;
  name: string;
  type?: string | null;
  number?: string | null;
  iconUrl?: string | null;
  bannerUrl?: string | null;
  instruction?: string | null;
  instructionBn?: string | null;
  payoutInstruction?: string | null;
  payoutInstructionBn?: string | null;
}

interface Props {
  method: SelectedMethod;
  mode: 'deposit' | 'withdraw';
  showCopy?: boolean;
  className?: string;
}

function fallbackColour(name: string): string {
  const n = name.toLowerCase();
  if (n.includes('bkash')) return '#E2136E';
  if (n.includes('nagad')) return '#EE2A24';
  if (n.includes('rocket')) return '#8B3793';
  if (n.includes('upay')) return '#13C2C2';
  if (n.includes('binance')) return '#F3BA2F';
  if (n.includes('usdt') || n.includes('tether')) return '#26A17B';
  return '#1F2937';
}

export function SelectedMethodCard({ method, mode, showCopy = true, className }: Props) {
  const { lang } = useLang();
  const [copied, setCopied] = useState(false);
  const bn = lang === 'bn';
  const numberLabel = bn
    ? mode === 'deposit' ? 'ওয়ালেট নম্বর' : 'পেমেন্ট নম্বর'
    : mode === 'deposit' ? 'Wallet No' : 'Payment No';
  const instruction = mode === 'deposit'
    ? (bn && method.instructionBn ? method.instructionBn : method.instruction)
    : (bn && method.payoutInstructionBn
      ? method.payoutInstructionBn
      : method.payoutInstruction
        ?? (bn && method.instructionBn ? method.instructionBn : method.instruction));
  const accent = fallbackColour(method.name);

  const onCopy = async () => {
    if (!method.number) return;
    try {
      await navigator.clipboard.writeText(method.number);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard not available */ }
  };

  return (
    <div className={cn('overflow-hidden rounded-2xl border border-brand-divider bg-brand-paper shadow-sm', className)}>
      {method.bannerUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={method.bannerUrl} alt="" className="h-32 w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/20 to-transparent" />
          <div className="absolute inset-x-4 bottom-3 flex items-center gap-3">
            {method.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={method.iconUrl} alt="" className="h-12 w-12 rounded-xl bg-white p-1 shadow" />
            ) : null}
            <p className="text-lg font-extrabold uppercase tracking-wider text-white drop-shadow">
              {method.name} {mode === 'deposit' ? (bn ? 'ডিপোজিট' : 'Deposit') : (bn ? 'উইথড্রয়াল' : 'Withdrawal')}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3 px-4 py-4" style={{ background: accent }}>
          {method.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={method.iconUrl} alt="" className="h-10 w-10 rounded-lg bg-white p-1" />
          ) : (
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-base font-extrabold text-white">
              {method.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <p className="text-base font-extrabold uppercase tracking-wider text-white">
            {method.name} {mode === 'deposit' ? (bn ? 'ডিপোজিট' : 'Deposit') : (bn ? 'উইথড্রয়াল' : 'Withdrawal')}
          </p>
        </div>
      )}

      <div className="space-y-3 px-4 py-4">
        {method.number ? (
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
              {numberLabel} <span className="text-rose-500">*</span>
            </p>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-brand-divider bg-brand-surface px-3 py-2.5">
              <span className="grow break-all font-mono text-base font-extrabold text-brand-ink">{method.number}</span>
              {showCopy ? (
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label={bn ? 'কপি করুন' : 'Copy'}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-brand-divider bg-brand-paper text-emerald-600 hover:border-emerald-400 hover:bg-emerald-50"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {instruction ? (
          <p className="whitespace-pre-line text-xs leading-relaxed text-brand-inkSoft">{instruction}</p>
        ) : null}
      </div>
    </div>
  );
}
