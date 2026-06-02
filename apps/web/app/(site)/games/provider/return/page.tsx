// Built by Anointed Coder.
//
// Provider return URL. The external game iframe / redirect lands
// here after the player closes the game window. We refresh the
// wallet and route them back to the lobby.

'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { BackBar } from '@/components/site/BackBar';
import { useLang } from '@/lib/i18n/context';
import { Wallet as WalletIcon, ArrowRight } from 'lucide-react';

export default function ProviderReturnPage() {
  const { lang } = useLang();
  const params = useSearchParams();
  const router = useRouter();
  const providerKey = params?.get('p') ?? null;

  useEffect(() => {
    // Best-effort wallet refresh trigger so the lobby reads the
    // latest balance once we hop back. Same event the header listens
    // to in WalletStrip.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pasha9:wallet-refresh'));
    }
    const timer = window.setTimeout(() => router.replace('/games'), 4000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <div className="space-y-6">
      <BackBar title={lang === 'bn' ? 'ফিরে এসেছেন' : 'Welcome back'} />
      <section className="grid place-items-center rounded-3xl border border-white/10 bg-black/40 p-10 text-center text-white">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-amber-300 to-amber-500 text-[#3A1F00] shadow-[inset_0_1px_0_rgba(255,255,255,0.55)]">
          <WalletIcon className="h-6 w-6" />
        </span>
        <h1 className="mt-3 text-2xl font-extrabold">
          {lang === 'bn' ? 'আপনি ফিরে এসেছেন' : 'You are back at Pasha 9'}
        </h1>
        <p className="mt-2 max-w-md text-sm text-white/85">
          {lang === 'bn'
            ? `ওয়ালেট ব্যালেন্স আপডেট করা হচ্ছে। কয়েক সেকেন্ডের মধ্যে গেম লবিতে নিয়ে যাওয়া হবে।${providerKey ? ` প্রোভাইডার: ${providerKey}` : ''}`
            : `Wallet balance is refreshing. You will be sent back to the games lobby in a moment.${providerKey ? ` Provider: ${providerKey}` : ''}`}
        </p>
        <Link href="/games" className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-5 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00]">
          {lang === 'bn' ? 'গেমে যান' : 'Open lobby'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </section>
    </div>
  );
}
