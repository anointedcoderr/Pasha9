// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Modal } from '@/components/ui/Modal';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { Button } from '@/components/ui/Button';
import { FormField, Input, PasswordInput } from '@/components/ui/Input';
import { Phone, Lock, KeyRound, UserPlus, User as UserIcon, Gift, Smartphone, ArrowLeft } from 'lucide-react';
import { loginSchema, signupSchema, type LoginInput, type SignupInput } from '@/lib/utils/validation';
import { useT, useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from './WalletStrip';

// Distinct from pasha9:wallet-refresh (which also fires on every deposit,
// withdrawal, reward claim, etc). Header listens for this one specifically
// to refresh its own logged-in/logged-out UI right after a real sign-in or
// sign-up, and the mobile app shell listens for it too, to force a full
// WebView reload so a fresh session is guaranteed to reflect everywhere.
const AUTH_CHANGED_EVENT = 'pasha9:auth-changed';

function triggerAuthChanged() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialTab?: 'login' | 'signup';
}

interface ApiError {
  code: string;
  message?: string;
}

export function AuthModal({ open, onOpenChange, initialTab = 'login' }: Props) {
  const t = useT();
  const [tab, setTab] = useState<'login' | 'signup'>(initialTab);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="md"
      title={
        <span className="text-gradient-gold">
          {tab === 'login' ? t('auth.loginTitle') : t('auth.signupTitle')}
        </span>
      }
      description={tab === 'login' ? t('auth.loginSub') : t('auth.signupSub')}
    >
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'login' | 'signup')}>
        <TabsList className="w-full">
          <TabsTrigger value="login" className="flex-1">{t('common.login')}</TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">{t('common.signup')}</TabsTrigger>
        </TabsList>

        <TabsContent value="login">
          <LoginForm onSuccess={() => onOpenChange(false)} />
        </TabsContent>
        <TabsContent value="signup">
          <SignupForm onSuccess={() => onOpenChange(false)} onSwitch={() => setTab('login')} />
        </TabsContent>
      </Tabs>
    </Modal>
  );
}

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);
  // M2K 2FA challenge state
  const [challenge, setChallenge] = useState<{ challengeToken: string; identifier: string } | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { identifier: '', password: '' } });

  const completeSuccess = () => {
    onSuccess();
    triggerWalletRefresh();
    triggerAuthChanged();
    const next = params?.get('next') ?? '/dashboard';
    // Defer the route change past the modal close so Radix Dialog's
    // body-style cleanup (overflow, padding-right that
    // react-remove-scroll applies while a modal is open) gets a
    // chance to commit before Next.js mounts the next page. Without
    // the defer, on iOS Safari the first tap on the new page can be
    // swallowed because gesture recognition is still attached to the
    // closing dialog subtree.
    setTimeout(() => {
      router.push(next);
      router.refresh();
    }, 0);
  };

  const onSubmit = async (values: LoginInput) => {
    setApiError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = { code: data.code ?? 'ERROR', message: data.message };
        setApiError(err);
        return;
      }
      if (data?.challenge === true && typeof data.challengeToken === 'string') {
        setChallenge({ challengeToken: data.challengeToken, identifier: values.identifier });
        setCode('');
        setUseRecovery(false);
        return;
      }
      completeSuccess();
    } catch {
      const msg = bn ? 'সার্ভারে পৌঁছানো যায়নি।' : 'Could not reach server.';
      setApiError({ code: 'NETWORK_ERROR', message: msg });
    } finally {
      setLoading(false);
    }
  };

  const onSubmitChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!challenge) return;
    setApiError(null);
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
          const msg = bn ? 'যাচাইয়ের সময়সীমা শেষ। অনুগ্রহ করে আবার লগইন করুন।' : 'The verification window expired. Please log in again.';
          setApiError({ code: 'CHALLENGE_INVALID', message: msg });
          setChallenge(null);
          setCode('');
          return;
        }
        const fallback = bn ? 'টু-ফ্যাক্টর যাচাই ব্যর্থ হয়েছে।' : '2FA verification failed.';
        const err = { code: data.code ?? 'ERROR', message: data.message ?? fallback };
        setApiError(err);
        return;
      }
      completeSuccess();
    } catch {
      const msg = bn ? 'সার্ভারে পৌঁছানো যায়নি।' : 'Could not reach server.';
      setApiError({ code: 'NETWORK_ERROR', message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (challenge) {
    return (
      <form onSubmit={onSubmitChallenge} className="space-y-4">
        <div className="rounded-lg border border-neon/15 bg-base-deep/40 p-3 text-sm">
          <p className="font-semibold text-ink-hi">
            {bn ? 'টু-ফ্যাক্টর যাচাই' : 'Two-factor verification'}
          </p>
          <p className="mt-1 text-xs text-ink-mid">
            {bn ? 'লগইন করছেন: ' : 'Signing in as '}
            <span className="font-semibold text-ink-hi">{challenge.identifier}</span>.{' '}
            {useRecovery
              ? (bn ? 'একটি একবার-ব্যবহারযোগ্য রিকভারি কোড দিন।' : 'Enter a single-use recovery code.')
              : (bn ? 'আপনার অথেনটিকেটর অ্যাপ থেকে ৬ অঙ্কের কোড দিন।' : 'Enter the 6-digit code from your authenticator app.')}
          </p>
        </div>
        <FormField
          label={useRecovery
            ? (bn ? 'রিকভারি কোড' : 'Recovery code')
            : (bn ? 'অথেনটিকেটর কোড' : 'Authenticator code')}
          required
          hint={useRecovery
            ? (bn
                ? 'প্রতিটি রিকভারি কোড শুধুমাত্র একবার কাজ করে। ব্যবহার করা কোড স্বয়ংক্রিয়ভাবে মুছে যায়।'
                : 'Each recovery code works exactly ONCE. Used codes are removed automatically.')
            : (bn
                ? 'Google Authenticator / Authy / 1Password খুলে বর্তমান ৬ অঙ্কের কোড কপি করুন।'
                : 'Open Google Authenticator / Authy / 1Password and copy the current 6-digit code.')}
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
        {apiError ? (
          <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{apiError.message ?? apiError.code}</p>
        ) : null}
        <Button full type="submit" size="lg" variant="gold" loading={loading} disabled={!code.trim() || (!useRecovery && code.length !== 6)}>
          {bn ? 'যাচাই করুন এবং লগইন' : 'Verify + sign in'}
        </Button>
        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => { setUseRecovery((v) => !v); setCode(''); setApiError(null); }}
            className="font-semibold text-brand-blue-600 hover:text-brand-blue-700"
          >
            {useRecovery
              ? (bn ? 'বদলে অথেনটিকেটর কোড দিন' : 'Use authenticator code instead')
              : (bn ? 'বদলে রিকভারি কোড দিন' : 'Use recovery code instead')}
          </button>
          <button
            type="button"
            onClick={() => { setChallenge(null); setCode(''); setUseRecovery(false); setApiError(null); }}
            className="inline-flex items-center gap-1 text-ink-mid hover:text-ink-hi"
          >
            <ArrowLeft className="h-3 w-3" /> {bn ? 'লগইনে ফিরে যান' : 'Back to login'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label={t('auth.phone')}
        required
        error={errors.identifier ? (bn ? 'ইউজারনেম বা ফোন নম্বর ৩ থেকে ৬৪ অক্ষরের হতে হবে।' : 'Username or phone must be 3 to 64 characters.') : undefined}
      >
        <Input
          leftIcon={<Phone className="h-4 w-4" />}
          placeholder="01XXXXXXXXX or username"
          inputMode="text"
          autoComplete="username"
          {...register('identifier')}
          invalid={!!errors.identifier}
        />
      </FormField>
      <FormField label={t('auth.password')} required error={errors.password ? t(`auth.${errors.password.message}`) : undefined}>
        <PasswordInput
          leftIcon={<Lock className="h-4 w-4" />}
          autoComplete="current-password"
          placeholder="••••••••"
          {...register('password')}
          invalid={!!errors.password}
        />
      </FormField>
      <div className="flex items-center justify-between text-sm">
        <a href="/forgot-password" className="font-semibold text-brand-blue-600 hover:text-brand-blue-700">{t('auth.forgot')}</a>
      </div>
      {apiError ? (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{apiError.message ?? apiError.code}</p>
      ) : null}
      <Button full type="submit" size="lg" variant="gold" loading={loading} leftIcon={<KeyRound className="h-4 w-4" />}>
        {t('common.login')}
      </Button>
    </form>
  );
}

function SignupForm({ onSuccess, onSwitch }: { onSuccess: () => void; onSwitch: () => void }) {
  const t = useT();
  const { lang } = useLang();
  const bn = lang === 'bn';
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<ApiError | null>(null);

  const referralFromUrl = params?.get('r') ?? '';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { username: '', phone: '', password: '', confirm: '', referral: referralFromUrl, agree: false },
  });

  const onSubmit = async (values: SignupInput) => {
    setApiError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: values.username,
          phone: values.phone,
          password: values.password,
          referral: values.referral || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const err = { code: data.code ?? 'ERROR', message: data.message };
        setApiError(err);
        return;
      }
      onSuccess();
      triggerWalletRefresh();
      triggerAuthChanged();
      // Same cleanup window as the login flow: let Radix Dialog
      // finish unmounting before we soft-route to /dashboard so
      // first-tap touch responsiveness on the destination page is
      // not blocked by the closing modal subtree.
      setTimeout(() => {
        router.push('/dashboard');
        router.refresh();
      }, 0);
    } catch {
      const msg = bn ? 'সার্ভারে পৌঁছানো যায়নি।' : 'Could not reach server.';
      setApiError({ code: 'NETWORK_ERROR', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Username" required error={errors.username?.message}>
        <Input leftIcon={<UserIcon className="h-4 w-4" />} placeholder="3 to 24 characters" autoComplete="username" {...register('username')} invalid={!!errors.username} />
      </FormField>
      <FormField label={t('auth.phone')} required error={errors.phone ? t(`auth.${errors.phone.message}`) : undefined}>
        <Input leftIcon={<Phone className="h-4 w-4" />} placeholder="01XXXXXXXXX" inputMode="tel" autoComplete="tel" {...register('phone')} invalid={!!errors.phone} />
      </FormField>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <FormField label={t('auth.password')} required error={errors.password ? t(`auth.${errors.password.message}`) : undefined}>
          <PasswordInput leftIcon={<Lock className="h-4 w-4" />} autoComplete="new-password" placeholder="••••••••" {...register('password')} invalid={!!errors.password} />
        </FormField>
        <FormField label={t('auth.confirm')} required error={errors.confirm ? t(`auth.${errors.confirm.message}`) : undefined}>
          <PasswordInput leftIcon={<Lock className="h-4 w-4" />} autoComplete="new-password" placeholder="••••••••" {...register('confirm')} invalid={!!errors.confirm} />
        </FormField>
      </div>
      <FormField label={t('auth.referral')}>
        <Input leftIcon={<Gift className="h-4 w-4" />} placeholder="ABCDE12" {...register('referral')} />
      </FormField>
      <label className="flex cursor-pointer items-start gap-2 text-sm text-ink-mid">
        <input type="checkbox" {...register('agree')} className="mt-1 h-4 w-4 accent-neon" />
        <span>{t('auth.agree')}</span>
      </label>
      {errors.agree ? <p className="-mt-2 text-xs text-signal-danger">{t(`auth.${errors.agree.message}`)}</p> : null}
      {apiError ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{apiError.message ?? apiError.code}</p> : null}
      <Button full type="submit" size="lg" variant="gold" loading={loading} leftIcon={<UserPlus className="h-4 w-4" />}>
        {t('common.signup')}
      </Button>
      <p className="text-center text-sm text-ink-lo">
        <button type="button" onClick={onSwitch} className="font-semibold text-brand-blue-600 hover:text-brand-blue-700">
          {t('auth.switchToLogin')}
        </button>
      </p>
    </form>
  );
}
