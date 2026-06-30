// Built by Anointed Coder.
//
// Public reset-password page. Accepts the one-time token from either
// the path (/reset-password/<token>) or the ?token= query so the
// operator can share the link in either form. The form collects a
// new password + confirmation and posts to /api/auth/reset-password,
// which validates the SHA-256 hash + status='approved' + not expired
// + not consumed, writes the new bcrypt hash and marks the row
// consumed.

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/lib/i18n/context';
import { ArrowLeft, KeyRound, CheckCircle2, LogIn, Eye, EyeOff } from 'lucide-react';

function ResetPasswordInner() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const params = useSearchParams();

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorNonce, setErrorNonce] = useState(0);
  const [done, setDone] = useState(false);

  const tokenRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  // Which field to move focus to after a failed submit.
  const focusTargetRef = useRef<'token' | 'password' | 'confirm'>('token');

  useEffect(() => {
    const q = params?.get('token') ?? '';
    if (q) setToken(q);
  }, [params]);

  // After a failed submit, move focus to the first invalid field so
  // keyboard and screen-reader users land on what needs fixing.
  useEffect(() => {
    if (!error) return;
    const ref =
      focusTargetRef.current === 'password' ? passwordRef
      : focusTargetRef.current === 'confirm' ? confirmRef
      : tokenRef;
    ref.current?.focus();
  }, [error, errorNonce]);

  const showError = (msg: string, target: 'token' | 'password' | 'confirm') => {
    focusTargetRef.current = target;
    setError(msg);
    setErrorNonce((n) => n + 1);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const t = token.trim();
    if (t.length < 20) {
      showError(bn ? 'অনুগ্রহ করে আপনার রিসেট কোড লিখুন।' : 'Please enter your reset code.', 'token');
      return;
    }
    if (password.length < 6) {
      showError(bn ? 'পাসওয়ার্ড অন্তত ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.', 'password');
      return;
    }
    if (password !== confirm) {
      showError(bn ? 'পাসওয়ার্ড মিলছে না।' : 'Passwords do not match.', 'confirm');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token: t, newPassword: password }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const code = j?.code as string | undefined;
        if (code === 'INVALID_TOKEN') {
          showError(bn ? 'অবৈধ রিসেট কোড।' : 'Invalid reset code.', 'token');
        } else if (code === 'ALREADY_USED') {
          showError(bn ? 'এই কোড ইতিমধ্যে ব্যবহৃত হয়েছে। নতুন রিকোয়েস্ট তৈরি করুন।' : 'This code has already been used. Please create a new request.', 'token');
        } else if (code === 'EXPIRED') {
          showError(bn ? 'এই কোডের মেয়াদ শেষ হয়েছে। নতুন রিকোয়েস্ট তৈরি করুন।' : 'This code has expired. Please create a new request.', 'token');
        } else if (r.status === 429) {
          showError(bn ? 'অনেক বেশি চেষ্টা। কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'Too many attempts. Please try again later.', 'token');
        } else {
          showError(j?.message ?? code ?? (bn ? 'রিসেট ব্যর্থ হয়েছে।' : 'Reset failed.'), 'token');
        }
        return;
      }
      setDone(true);
    } catch (err) {
      showError(err instanceof Error ? err.message : (bn ? 'নেটওয়ার্ক ত্রুটি।' : 'Network error.'), 'token');
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
          {bn ? 'পাসওয়ার্ড রিসেট' : 'Reset password'}
        </h1>
        <p className="mt-1 text-sm text-brand-inkSoft">
          {bn
            ? 'অ্যাডমিনের কাছ থেকে পাওয়া ওয়ান-টাইম কোড এবং আপনার নতুন পাসওয়ার্ড লিখুন।'
            : 'Enter the one-time code the operator gave you and your new password.'}
        </p>

        {done ? (
          <div className="mt-5 space-y-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-900">
            <p className="inline-flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 className="h-4 w-4" />
              {bn ? 'পাসওয়ার্ড সফলভাবে রিসেট হয়েছে।' : 'Password reset successful.'}
            </p>
            <p className="text-xs">
              {bn ? 'আপনি এখন নতুন পাসওয়ার্ড দিয়ে লগইন করতে পারেন।' : 'You can now log in with your new password.'}
            </p>
            <Link
              href="/?login=1"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00]"
            >
              <LogIn className="h-3.5 w-3.5" />
              {bn ? 'লগইন' : 'Log in'}
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                {bn ? 'ওয়ান-টাইম রিসেট কোড' : 'One-time reset code'}
              </span>
              <input
                ref={tokenRef}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your reset code"
                className="mt-1 h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 font-mono text-xs text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                {bn ? 'নতুন পাসওয়ার্ড' : 'New password'}
              </span>
              <div className="mt-1 flex items-center gap-2 rounded-lg border border-brand-divider bg-brand-paper pr-2">
                <input
                  ref={passwordRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-11 grow rounded-lg bg-transparent px-3 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? (bn ? 'লুকান' : 'Hide') : (bn ? 'দেখান' : 'Show')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-brand-inkSoft hover:text-brand-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            <label className="block">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
                {bn ? 'নতুন পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm new password'}
              </span>
              <input
                ref={confirmRef}
                type={showPassword ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className="mt-1 h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70"
            >
              {loading ? (bn ? 'রিসেট হচ্ছে...' : 'Resetting...') : (bn ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset password')}
            </button>

            <p className="text-[11px] text-brand-inkMute">
              {bn ? 'প্রতিটি কোড একবার ব্যবহার করা যায় এবং অনুমোদনের ৩০ মিনিট পরে মেয়াদ শেষ হয়।' : 'Each code is single-use and expires 30 minutes after approval.'}
            </p>
          </form>
        )}

        <div className="mt-6 border-t border-brand-divider pt-4 text-xs text-brand-inkMute">
          <p>
            {bn ? 'কোড নেই?' : 'No code yet?'}{' '}
            <Link href="/forgot-password" className="font-semibold text-brand-blue-600 hover:text-brand-blue-700">
              {bn ? 'রিকোয়েস্ট পাঠান' : 'Request a reset'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="mx-auto w-full max-w-md py-8" />}>
      <ResetPasswordInner />
    </Suspense>
  );
}
