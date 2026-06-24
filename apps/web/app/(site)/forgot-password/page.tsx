// Built by Anointed Coder.
//
// Public forgot-password entry. Two flows:
//
//  1. SMS OTP reset. Three steps: phone -> SMS code -> new password.
//     Renders only when the operator has flipped SystemSetting
//     'forgot_password_enabled' = '1'. The code is sent through the
//     configured SMS provider (set at /admin/notifications) and is
//     verified server side; no third-party identity provider is used.
//
//  2. Admin-assisted reset (legacy fallback). Player submits username,
//     phone or email; admin reviews from /admin/password-resets and
//     hands back a one-time code redeemed at /reset-password.

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLang } from '@/lib/i18n/context';
import {
  ArrowLeft,
  KeyRound,
  MessageCircle,
  CheckCircle2,
  Phone,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react';

type Step = 'phone' | 'code' | 'password' | 'done';

interface SiteConfig {
  forgotPasswordEnabled: boolean;
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const { lang } = useLang();
  const bn = lang === 'bn';

  // ----- Feature-flag probe -----
  const [config, setConfig] = useState<SiteConfig | null>(null);
  useEffect(() => {
    let alive = true;
    fetch('/api/site/config', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        setConfig({ forgotPasswordEnabled: Boolean(j?.forgotPasswordEnabled) });
      })
      .catch(() => { if (alive) setConfig({ forgotPasswordEnabled: false }); });
    return () => { alive = false; };
  }, []);

  const smsFlowOn = !!config?.forgotPasswordEnabled;

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
            ? 'আপনার রেজিস্টার্ড ফোন নম্বরে SMS কোড পেয়ে পাসওয়ার্ড রিসেট করুন।'
            : 'Reset your password using the SMS code sent to your registered phone.'}
        </p>

        {config === null ? (
          <p className="mt-6 text-sm text-brand-inkSoft">{bn ? 'লোড হচ্ছে...' : 'Loading...'}</p>
        ) : smsFlowOn ? (
          <SmsOtpFlow router={router} bn={bn} />
        ) : (
          <LegacyFlow bn={bn} />
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

// =============================================================
// SMS OTP three-step flow
// =============================================================

function SmsOtpFlow({ router, bn }: { router: ReturnType<typeof useRouter>; bn: boolean }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [newPw, setNewPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true); setError(null);
    try {
      const digits = phone.replace(/\D/g, '');
      if (digits.length < 11) {
        setError(bn ? 'সঠিক বাংলাদেশী মোবাইল নম্বর লিখুন (01XXXXXXXXX)।' : 'Enter a valid Bangladesh mobile number (01XXXXXXXXX).');
        return;
      }
      const r = await fetch('/api/auth/forgot/sms/start', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        if (j?.code === 'FORGOT_DISABLED') setError(bn ? 'SMS রিসেট বর্তমানে বন্ধ। সাপোর্টে যোগাযোগ করুন।' : 'SMS reset is turned off right now. Please contact support.');
        else if (r.status === 429) setError(bn ? 'অনেক বেশি চেষ্টা। কিছুক্ষণ পরে আবার চেষ্টা করুন।' : 'Too many attempts. Please try again shortly.');
        else setError(bn ? 'কোড পাঠানো যায়নি। আবার চেষ্টা করুন।' : 'Could not send the code. Please try again.');
        return;
      }
      setStep('code');
    } catch {
      setError(bn ? 'নেটওয়ার্ক ত্রুটি।' : 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  // The code is verified together with the new password in the final
  // step, so this just sanity-checks the format and advances.
  const goToPassword = () => {
    setError(null);
    if (code.trim().length !== 6) {
      setError(bn ? '৬-সংখ্যার কোড লিখুন।' : 'Enter the 6-digit code.');
      return;
    }
    setStep('password');
  };

  const submitPassword = async () => {
    setBusy(true); setError(null);
    try {
      if (newPw.length < 6) {
        setError(bn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে।' : 'Password must be at least 6 characters.');
        return;
      }
      const r = await fetch('/api/auth/forgot/sms/complete', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone, code, newPassword: newPw }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok) {
        const c = j?.code as string | undefined;
        if (c === 'OTP_MISMATCH') { setError(bn ? 'কোডটি ভুল। আবার চেষ্টা করুন।' : 'The code is incorrect. Try again.'); setStep('code'); }
        else if (c === 'OTP_TOO_MANY_ATTEMPTS' || c === 'OTP_NOT_FOUND' || c === 'ALREADY_USED') { setError(bn ? 'কোডের মেয়াদ শেষ বা ভুল। নতুন কোড নিন।' : 'The code expired or is invalid. Request a new one.'); setStep('phone'); setCode(''); }
        else if (c === 'USER_BLOCKED') setError(bn ? 'অ্যাকাউন্ট স্থগিত। সাপোর্টে যোগাযোগ করুন।' : 'This account is suspended. Please contact support.');
        else setError(bn ? 'রিসেট ব্যর্থ।' : 'Reset failed.');
        return;
      }
      setStep('done');
      setTimeout(() => router.push('/?login=1'), 2500);
    } catch {
      setError(bn ? 'নেটওয়ার্ক ত্রুটি।' : 'Network error.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 space-y-4">
      {/* Step strip */}
      <ol className="flex items-center justify-between gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">
        {(['phone', 'code', 'password', 'done'] as Step[]).map((s, i) => {
          const order: Step[] = ['phone', 'code', 'password', 'done'];
          const active = order.indexOf(step) >= i;
          return (
            <li key={s} className="flex flex-1 items-center gap-1">
              <span className={
                'inline-flex h-5 w-5 items-center justify-center rounded-full ' +
                (active ? 'bg-brand-yellow-500 text-[#3a1f00]' : 'bg-brand-divider text-brand-inkMute')
              }>{i + 1}</span>
              <span className={active ? 'text-brand-ink' : ''}>
                {s === 'phone' ? (bn ? 'ফোন' : 'Phone') : s === 'code' ? (bn ? 'কোড' : 'Code') : s === 'password' ? (bn ? 'পাসওয়ার্ড' : 'Password') : (bn ? 'সফল' : 'Done')}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Step 1 - Phone */}
      {step === 'phone' ? (
        <form onSubmit={(e) => { e.preventDefault(); void sendCode(); }} className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
              {bn ? 'ফোন নম্বর' : 'Phone number'}
            </span>
            <div className="relative mt-1">
              <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-inkMute" />
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                autoComplete="tel"
                placeholder="01XXXXXXXXX"
                className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper pl-9 pr-3 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
              />
            </div>
          </label>

          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <button type="submit" disabled={busy} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70">
            {busy ? (bn ? 'পাঠানো হচ্ছে...' : 'Sending...') : (bn ? 'SMS কোড পাঠান' : 'Send SMS code')}
          </button>

          <p className="text-[11px] text-brand-inkMute">
            {bn
              ? 'আপনার রেজিস্টার্ড নম্বরে SMS কোড পাঠানো হবে। কেবলমাত্র বাংলাদেশের নম্বর সাপোর্ট করা হয়।'
              : 'An SMS code will be sent to your registered number. Only Bangladesh numbers are supported.'}
          </p>
        </form>
      ) : null}

      {/* Step 2 - Code */}
      {step === 'code' ? (
        <form onSubmit={(e) => { e.preventDefault(); goToPassword(); }} className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
              {bn ? '৬-সংখ্যার কোড' : '6-digit code'}
            </span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="mt-1 h-11 w-full rounded-lg border border-brand-divider bg-brand-paper px-3 text-center text-lg font-mono tracking-[0.5em] text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
            />
          </label>

          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <button type="submit" disabled={code.length !== 6} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70">
            {bn ? 'পরবর্তী ধাপ' : 'Continue'}
          </button>

          <button type="button" onClick={() => { setStep('phone'); setCode(''); setError(null); }} className="text-xs font-semibold text-brand-blue-600 hover:text-brand-blue-700">
            {bn ? 'অন্য নম্বর দিন' : 'Use a different phone'}
          </button>
        </form>
      ) : null}

      {/* Step 3 - New password */}
      {step === 'password' ? (
        <form onSubmit={(e) => { e.preventDefault(); void submitPassword(); }} className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-bold uppercase tracking-wider text-brand-inkMute">
              {bn ? 'নতুন পাসওয়ার্ড' : 'New password'}
            </span>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-inkMute" />
              <input
                type={showPw ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder={bn ? 'কমপক্ষে ৬ অক্ষর' : 'At least 6 characters'}
                className="h-11 w-full rounded-lg border border-brand-divider bg-brand-paper pl-9 pr-9 text-sm text-brand-ink placeholder:text-brand-inkMute focus:outline-none focus:ring-2 focus:ring-brand-yellow-500/40"
              />
              <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-inkMute hover:text-brand-ink">
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </label>

          {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

          <button type="submit" disabled={busy || newPw.length < 6} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70">
            {busy ? (bn ? 'রিসেট হচ্ছে...' : 'Resetting...') : (bn ? 'পাসওয়ার্ড রিসেট করুন' : 'Reset password')}
          </button>

          <p className="text-[11px] text-brand-inkMute">
            {bn
              ? 'রিসেট করার পরে আপনার অন্য সব ডিভাইস থেকে লগআউট হবে।'
              : 'Resetting will sign you out of every other device.'}
          </p>
        </form>
      ) : null}

      {/* Step 4 - Done */}
      {step === 'done' ? (
        <div className="space-y-3 rounded-xl border border-emerald-300/60 bg-emerald-50 p-4 text-emerald-900">
          <p className="inline-flex items-center gap-2 text-sm font-bold">
            <CheckCircle2 className="h-4 w-4" />
            {bn ? 'পাসওয়ার্ড রিসেট সফল হয়েছে।' : 'Password reset successful.'}
          </p>
          <p className="text-xs">
            {bn ? 'আপনার নতুন পাসওয়ার্ড দিয়ে লগইন করুন।' : 'Use your new password to log in.'}
          </p>
        </div>
      ) : null}
    </div>
  );
}

// =============================================================
// Legacy admin-assisted flow (kept for back-compat / fallback)
// =============================================================

function LegacyFlow({ bn }: { bn: boolean }) {
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
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
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
          <Link href="/support" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-emerald-400/40 bg-white px-3 text-xs font-bold uppercase tracking-wider text-emerald-700 hover:bg-emerald-50">
            <MessageCircle className="h-3.5 w-3.5" />
            {bn ? 'লাইভ সাপোর্ট' : 'Contact support'}
          </Link>
          <Link href="/reset-password" className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 px-3 text-xs font-extrabold uppercase tracking-wider text-[#3A1F00]">
            {bn ? 'রিসেট কোড আছে?' : 'I have a reset code'}
          </Link>
        </div>
      </div>
    );
  }

  return (
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

      {error ? <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}

      <button type="submit" disabled={loading} className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-gradient-to-b from-amber-300 to-amber-500 text-sm font-extrabold uppercase tracking-wider text-[#3A1F00] disabled:opacity-70">
        {loading ? (bn ? 'জমা হচ্ছে...' : 'Submitting...') : (bn ? 'রিসেট রিকোয়েস্ট জমা দিন' : 'Submit reset request')}
      </button>

      <p className="text-[11px] text-brand-inkMute">
        {bn
          ? 'নিরাপত্তার কারণে আমরা প্রকাশ করি না যে অ্যাকাউন্ট আছে কিনা। অ্যাডমিন আপনার অনুরোধ যাচাই করবেন।'
          : 'For security reasons we never confirm whether an account exists. The operator will verify your request.'}
      </p>
    </form>
  );
}
