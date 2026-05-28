// Built by Anointed Coder.
//
// Slide-up drawer (or right-side on desktop) that hosts the provably-
// fair payload + the two session-management actions. Hidden behind a
// pill in the game shell so the play surface stays uncluttered.

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, RefreshCw, Sparkles, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useLang } from '@/lib/i18n/context';
import type { UseNativeGameResult } from '@/lib/native-games/use-native-game';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ng: UseNativeGameResult;
}

export function FairnessDrawer({ open, onOpenChange, ng }: Props) {
  const { lang } = useLang();
  const s = ng.session;
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-white/10 bg-[#0F0A1E] p-5 text-white shadow-2xl outline-none',
            'md:left-auto md:right-6 md:top-1/2 md:bottom-auto md:inset-x-auto md:w-[420px] md:max-w-[90vw] md:-translate-y-1/2 md:rounded-2xl md:border',
          )}
        >
          <div className="flex items-center justify-between gap-2">
            <Dialog.Title className="inline-flex items-center gap-2 text-base font-extrabold">
              <ShieldCheck className="h-4 w-4 text-emerald-300" />
              {lang === 'bn' ? 'প্রভাবলি ফেয়ার' : 'Provably fair'}
            </Dialog.Title>
            <Dialog.Close className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <Dialog.Description className="mt-1 text-xs text-white/65">
            {lang === 'bn'
              ? 'হ্যাশ এখনই প্রকাশ্য। সেশন বন্ধ করলে মূল সার্ভার সিড প্রকাশিত হবে এবং প্রতিটি রাউন্ড নিজেই যাচাই করা যাবে।'
              : 'The hash is public now. Close the session to reveal the underlying server seed so every round can be re-derived.'}
          </Dialog.Description>

          {s ? (
            <div className="mt-4 grid gap-3">
              <Detail label={lang === 'bn' ? 'সার্ভার সিড হ্যাশ' : 'Server seed hash'} value={s.serverSeedHash} mono />
              <Detail label={lang === 'bn' ? 'ক্লায়েন্ট সিড' : 'Client seed'} value={s.clientSeed} mono />
              <div className="grid grid-cols-2 gap-3">
                <Detail label={lang === 'bn' ? 'ননস' : 'Nonce'} value={String(s.nonce)} />
                <Detail label={lang === 'bn' ? 'স্ট্যাটাস' : 'Status'} value={s.status} />
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-white/60">{lang === 'bn' ? 'সেশন তৈরি হচ্ছে...' : 'Opening session...'}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={ng.closeSessionAndReveal}
              disabled={!s}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 text-xs font-bold uppercase tracking-wider text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {lang === 'bn' ? 'বন্ধ + যাচাই' : 'Close + verify'}
            </button>
            <button
              type="button"
              onClick={ng.newSession}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 text-xs font-bold uppercase tracking-wider text-white hover:bg-white/10"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {lang === 'bn' ? 'নতুন সেশন' : 'New session'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className="text-[10px] font-bold uppercase tracking-wider text-white/55">{label}</p>
      <p className={cn('mt-1 break-all text-sm text-white', mono && 'font-mono text-xs')}>{value}</p>
    </div>
  );
}
