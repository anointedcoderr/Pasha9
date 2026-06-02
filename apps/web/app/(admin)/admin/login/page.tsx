// Built by Anointed Coder.
//
// Admin login. M2K hotfix: supports the two-step 2FA challenge
// returned by /api/admin/login when totpEnabled=true. Step 1 stays
// the same (username + password). Step 2 prompts for a 6-digit
// authenticator code with a toggle to use a single-use recovery
// code instead. Submits to /api/auth/2fa/challenge to complete
// login. Back button returns to step 1.

'use client';

// Login form needs the live URL. force-dynamic stops Next.js from
// attempting to prerender and ensures useSearchParams() resolves to
// a real URLSearchParams object instead of null.
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Logo } from '@/components/site/Logo';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { BRAND } from '@/lib/constants/brand';
import { useT } from '@/lib/i18n/context';
import { Lock, ShieldCheck, User as UserIcon, KeyRound, ArrowLeft, Smartphone } from 'lucide-react';

interface PendingChallenge {
  challengeToken: string;
  username: string;
}

export default function AdminLoginPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: credentials
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // Step 2: 2FA challenge
  const [challenge, setChallenge] = useState<PendingChallenge | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const onSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message ?? data.code ?? 'Login failed');
        return;
      }
      if (data?.challenge === true && typeof data.challengeToken === 'string') {
        setChallenge({ challengeToken: data.challengeToken, username });
        setCode('');
        setUseRecovery(false);
        return;
      }
      // No 2FA - cookies are already set.
      const next = params?.get('next') ?? '/admin';
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  const onSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/2fa/challenge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeToken: challenge.challengeToken, code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data?.code === 'CHALLENGE_INVALID') {
          setError('The verification window expired. Please log in again.');
          setChallenge(null);
          setCode('');
          return;
        }
        setError(data.message ?? data.code ?? '2FA verification failed.');
        return;
      }
      const next = params?.get('next') ?? '/admin';
      router.push(next);
      router.refresh();
    } catch {
      setError('Could not reach server');
    } finally {
      setLoading(false);
    }
  };

  const backToCredentials = () => {
    setChallenge(null);
    setCode('');
    setUseRecovery(false);
    setError(null);
  };

  return (
    <div className="font-admin relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 left-1/2 h-72 w-[110%] -translate-x-1/2 rounded-full bg-grad-radial-glow blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-base-deep via-base-deep/40 to-transparent" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="card-glow p-8 ring-gold-soft">
          <div className="mb-6 flex items-center justify-between">
            <Logo size="lg" />
            <span className="inline-flex items-center gap-1.5 rounded-pill border border-neon/30 bg-neon/10 px-3 py-1 text-[10px] uppercase tracking-wider text-neon">
              <ShieldCheck className="h-3 w-3" /> Admin
            </span>
          </div>

          {!challenge ? (
            <>
              <h1 className="text-2xl font-bold text-gradient-gold">{t('admin.loginTitle')}</h1>
              <p className="mt-1 text-sm text-ink-mid">{t('admin.loginSub')}</p>

              <form className="mt-6 space-y-4" onSubmit={onSubmitCredentials}>
                <FormField label={t('admin.username')} required>
                  <Input
                    leftIcon={<UserIcon className="h-4 w-4" />}
                    placeholder="admin username"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </FormField>
                <FormField label={t('admin.password')} required>
                  <PasswordInput
                    leftIcon={<Lock className="h-4 w-4" />}
                    placeholder="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </FormField>
                {error ? <p className="text-sm text-signal-danger">{error}</p> : null}
                <Button full type="submit" size="lg" loading={loading}>
                  {t('admin.loginBtn')}
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-gradient-gold">Two-factor verification</h1>
              <p className="mt-1 text-sm text-ink-mid">
                Signing in as <span className="font-semibold text-ink-hi">{challenge.username}</span>.
                {useRecovery
                  ? ' Enter a single-use recovery code.'
                  : ' Enter the 6-digit code from your authenticator app.'}
              </p>

              <form className="mt-6 space-y-4" onSubmit={onSubmitChallenge}>
                <FormField
                  label={useRecovery ? 'Recovery code' : 'Authenticator code'}
                  required
                  hint={useRecovery
                    ? 'Each recovery code works exactly ONCE. Used codes are removed automatically.'
                    : 'Open Google Authenticator / Authy / 1Password and copy the current 6-digit code.'}
                >
                  <Input
                    leftIcon={useRecovery ? <KeyRound className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                    placeholder={useRecovery ? 'ABCDEFGHIJ' : '123456'}
                    value={code}
                    onChange={(e) => setCode(useRecovery ? e.target.value.toUpperCase() : e.target.value.replace(/\D/g, ''))}
                    inputMode={useRecovery ? 'text' : 'numeric'}
                    maxLength={useRecovery ? 12 : 6}
                    autoFocus
                  />
                </FormField>

                {error ? <p className="text-sm text-signal-danger">{error}</p> : null}

                <Button full type="submit" size="lg" loading={loading} disabled={!code.trim() || (!useRecovery && code.length !== 6)}>
                  Verify + sign in
                </Button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => { setUseRecovery((v) => !v); setCode(''); setError(null); }}
                    className="font-semibold text-brand-blue-600 hover:text-brand-blue-700"
                  >
                    {useRecovery ? 'Use authenticator code instead' : 'Use recovery code instead'}
                  </button>
                  <button
                    type="button"
                    onClick={backToCredentials}
                    className="inline-flex items-center gap-1 text-ink-mid hover:text-ink-hi"
                  >
                    <ArrowLeft className="h-3 w-3" /> Back to login
                  </button>
                </div>
              </form>
            </>
          )}

          <div className="mt-6 border-t border-neon/10 pt-4 text-center text-[11px] text-ink-lo">
            <p>
              Built by{' '}
              <a
                href={BRAND.developer.website}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-ink-mid underline-offset-2 hover:text-ink-hi hover:underline"
              >
                {BRAND.developer.name}
              </a>
            </p>
            <p className="mt-1">
              <a href={`mailto:${BRAND.developer.email}`} className="hover:text-ink-hi">{BRAND.developer.email}</a>
            </p>
            <p className="mt-3">
              <Link href="/" className="text-ink-mid hover:text-ink-hi">Back to site</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
