// Built by Anointed Coder.
//
// Premium full-bleed banner rendered by the Header when /api/auth/me
// reports the visitor's status === 'blocked'. Shows the suspension
// notice, the admin-set reason (if any), the timestamp (if any), the
// public support buttons sourced from /api/content/contacts (same
// shape FloatingContact uses) and a Log out button that clears the
// session cookies and returns the visitor to a clean guest state.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertOctagon, LogOut, MessageCircle, Send, Mail, Headphones } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from './WalletStrip';

interface BlockedAccountBannerProps {
  username: string;
  reason?: string | null;
  at?: string | null;
}

interface Contacts {
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function BlockedAccountBanner({ username, reason, at }: BlockedAccountBannerProps) {
  const { lang } = useLang();
  const router = useRouter();
  const [contacts, setContacts] = useState<Contacts | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/contacts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setContacts({
            telegram: data.telegram ?? null,
            whatsapp: data.whatsapp ?? null,
            email: data.email ?? null,
          });
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      /* ignore */
    }
    // Forget the once-only WinGo rules acceptance on forced logout.
    try { window.localStorage.removeItem('pasha9:wingo_rules_accepted'); } catch { /* ignore */ }
    triggerWalletRefresh();
    router.replace('/');
    router.refresh();
  };

  const formattedAt = at
    ? new Date(at).toLocaleString(lang === 'bn' ? 'bn-BD' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null;

  return (
    <section
      role="alert"
      aria-live="polite"
      className="relative z-20 overflow-hidden bg-[linear-gradient(135deg,#1A0606_0%,#2A0A0A_55%,#1A0606_100%)] text-white"
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-400/60 to-transparent" />
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-red-500/30 blur-3xl" />
      <span aria-hidden className="pointer-events-none absolute -left-12 -bottom-16 h-56 w-56 rounded-full bg-amber-500/20 blur-3xl" />

      <div className="relative mx-auto flex max-w-page flex-col gap-4 px-4 py-5 md:px-6 md:py-6 lg:flex-row lg:items-start">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-500/15 text-red-300 ring-1 ring-red-400/30">
          <AlertOctagon className="h-6 w-6" />
        </span>

        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">
            {lang === 'bn' ? 'অ্যাকাউন্ট স্থগিত' : 'Account suspended'}
          </p>
          <h2 className="mt-1 text-lg font-extrabold leading-tight text-white md:text-xl">
            {lang === 'bn'
              ? `${username}, আপনার অ্যাকাউন্ট সাময়িকভাবে বন্ধ আছে`
              : `${username}, your account has been suspended`}
          </h2>
          {reason ? (
            <p className="mt-2 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm leading-snug text-red-100">
              <span className="font-bold">{lang === 'bn' ? 'কারণ' : 'Reason'}: </span>
              {reason}
            </p>
          ) : (
            <p className="mt-2 text-sm leading-snug text-white/80">
              {lang === 'bn'
                ? 'অনুগ্রহ করে আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
                : 'Please contact our support team to resolve this.'}
            </p>
          )}
          {formattedAt ? (
            <p className="mt-1 text-[11px] text-white/55">
              {lang === 'bn' ? 'সময়' : 'Effective'}: {formattedAt}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-2">
            {contacts?.whatsapp ? (
              <a
                href={contacts.whatsapp}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#25D366] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              >
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            ) : null}
            {contacts?.telegram ? (
              <a
                href={contacts.telegram}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#229ED9] px-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
              >
                <Send className="h-4 w-4" /> Telegram
              </a>
            ) : null}
            <Link
              href="/support"
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-yellow-500 px-3 text-sm font-semibold text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_4px_rgba(168,114,0,0.35)]"
            >
              <Headphones className="h-4 w-4" /> {lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat'}
            </Link>
            {contacts?.email ? (
              <a
                href={`mailto:${contacts.email}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm font-semibold text-white backdrop-blur"
              >
                <Mail className="h-4 w-4" /> {lang === 'bn' ? 'ইমেইল' : 'Email'}
              </a>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={logout}
          disabled={loggingOut}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 disabled:opacity-60"
        >
          <LogOut className="h-4 w-4" />
          {loggingOut
            ? lang === 'bn'
              ? 'লগআউট হচ্ছে...'
              : 'Logging out...'
            : lang === 'bn'
              ? 'লগআউট'
              : 'Log out'}
        </button>
      </div>
    </section>
  );
}
