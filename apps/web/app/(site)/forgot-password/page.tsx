// Built by Anointed Coder.
//
// Public forgot-password entry page. The user submits a username,
// phone or email. The endpoint always returns a generic success
// message so account existence is never revealed. The admin reviews
// the request from /admin/password-resets and approves to issue a
// one-time token that the user then redeems at /reset-password.

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useT, useLang } from '@/lib/i18n/context';
import { ArrowLeft, KeyRound, MessageCircle, CheckCircle2 } from 'lucide-react';

export default function ForgotPasswordPage() {
  const t = useT();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const id = identifier.trim();
    if (id.length < 3) {
      setError(bn ? 'অনুগ্রহ করে আপনার ইউজারনেম, ফোন নম্বর বা ইমেইল লিখুন।' : 'Please enter your username, phone or email.');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ identifier: id }),
      });
      if (r.status === 429) {
        setError(bn ? 'অনেক বেশি চেষ্টা। এক ঘন্টা পরে আবার চেষ্টা করুন।' : 'Too many attempts. Please try again in an hour.');
        return;
      }
      // Privacy-safe: the endpoint always returns 200 + a generic
      // message. We surface the success card regardless of whether the
      // account existed so we never leak that information.
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md py-8">
      <div className="rounded-2xl border border-brand-divider bg-brand-paper p-6 shadow-sm">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-inkMute hover:text-brand-ink">
          <ArrowLeft className="h-3.5 w-3.5" /> {bn ? 'হোম' : 'Home'}
        </Link>

        <h1 className="mt-3 inline-flex items-center gap-2 text-2xl font-extrabold text-brand-ink">
          <KeyRound className="h-5 w-5 text-brand-yellow-700" />
          {bn ? 'পাসওয়ার্ড ভুলে গেছেন?' : 'Forgot password?'}
        </h1>
        <p className="mt-1 text-sm text-brand-inkSoft">
          {bn
            ? 'আপনার অ্যাকাউন্ট খুঁজে পাওয়ার জন্য আপনার ইউজারনেম, ফোন নম্বর বা ইমেইল লিখুন।'
            : 'Enter your username, phone number or email so we can find your account.'}
        </p>

        {submitted ? (
          <div className="mt-5 space-y-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-900">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4" />
              {bn ? 'রিকোয়েস্ট জমা হয়েছে।' : 'Request submitted.'}
            </p>
            <p className="text-xs">
              {bn
                ? 'অ্যাকাউন্ট পাওয়া গেলে একটি পাসওয়ার্ড রিসেট রিকোয়েস্ট তৈরি করা হয়েছে। অ্যাডমিন এটি যাচাই করার পর আপনাকে একটি ওয়ান-টাইম রিসেট কোড দেবেন। অনুগ্রহ করে লাইভ সাপোর্টে যোগাযোগ করুন।'
                : 'If the account exists, a reset request has been created. The operator will verify and share a one-time reset code with you. Please contact live support to receive your code.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href="/support"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-white px-3 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-50"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {bn ? 'লাইভ সাপোর্ট' : 'Contact support'}
              </Link>
              <Link
                href="/reset-password"
                className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00]"
              >
                {bn ? 'রিসেট কোড আছে?' : 'I have a reset code'}
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                {bn ? 'ইউজারনেম, ফোন বা ইমেইল' : 'Username, phone or email'}
              </span>
              <input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                placeholder="01XXXXXXXXX or username"
                className="mt-1 h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
              />
            </label>

            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70"
            >
              {loading ? (bn ? 'জমা হচ্ছে...' : 'Submitting...') : (bn ? 'রিসেট রিকোয়েস্ট জমা দিন' : 'Submit reset request')}
            </button>

            <p className="text-[11px] text-brand-inkMute">
              {bn
                ? 'নিরাপত্তার কারণে আমরা প্রকাশ করি না যে অ্যাকাউন্ট আছে কিনা। অ্যাডমিন আপনার অনুরোধ যাচাই করবেন।'
                : 'For security reasons we never confirm whether an account exists. The operator will verify your request.'}
            </p>
          </form>
        )}

        <div className="mt-6 border-t border-brand-divider pt-4 text-xs text-brand-inkMute">
          <p>
            {bn ? 'মনে আছে?' : 'Remembered it?'}{' '}
            <Link href="/?login=1" className="font-semibold text-brand-blue-600 hover:text-brand-blue-700">
              {bn ? 'লগইন' : 'Log in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
