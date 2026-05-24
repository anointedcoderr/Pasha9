'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/site/PageHeader';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { withdrawalSchema, type WithdrawalInput } from '@/lib/utils/validation';
import { mockPaymentMethods } from '@/lib/mock/payment-methods';
import { useT } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { AlertTriangle, ArrowUpToLine, CheckCircle2, Lock, LogIn, ShieldCheck } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

const QUICK = [500, 1000, 2500, 5000, 10000];
const DEFAULT_METHOD = mockPaymentMethods[0]?.name ?? '';

type AuthState =
  | { kind: 'checking' }
  | { kind: 'guest' }
  | { kind: 'authed'; username: string; balance: number };

export default function WithdrawPage() {
  const t = useT();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetail, setServerDetail] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' });

  useEffect(() => {
    let alive = true;
    const probe = () => {
      fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive) return;
          if (data?.user?.username) {
            setAuth({
              kind: 'authed',
              username: String(data.user.username),
              balance: Number(data.user.wallet?.balance ?? 0),
            });
          } else {
            setAuth({ kind: 'guest' });
          }
        })
        .catch(() => { if (alive) setAuth({ kind: 'guest' }); });
    };
    probe();
    const handler = () => probe();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => {
      alive = false;
      window.removeEventListener('pasha9:wallet-refresh', handler);
    };
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, method: DEFAULT_METHOD, account: '', holder: '' },
  });

  const errorEntries = Object.entries(errors).map(([field, e]) => ({
    field,
    message: e?.message ? String(e.message) : 'Invalid value',
  }));

  const onSubmit = async (values: WithdrawalInput) => {
    setServerError(null);
    setServerDetail(null);

    if (auth.kind !== 'authed') {
      setServerError('Please log in before submitting a withdrawal.');
      router.push('/?login=1');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: Number(values.amount),
          method: values.method,
          accountNumber: values.account,
          accountName: values.holder,
        }),
      });
      const data = await res.json().catch(() => ({} as Record<string, unknown>));

      if (!res.ok) {
        const code = typeof data?.code === 'string' ? (data.code as string) : null;
        const message = typeof data?.message === 'string' ? (data.message as string) : null;
        if (res.status === 401) {
          setServerError('Your session has expired. Please log in again.');
          setAuth({ kind: 'guest' });
          router.push('/?login=1');
          return;
        }
        if (res.status === 429) {
          setServerError('Too many submissions. Please wait a minute and try again.');
          return;
        }
        if (code === 'INSUFFICIENT_FUNDS') {
          setServerError('Withdrawable balance is lower than the requested amount.');
          setServerDetail(`HTTP 400 · INSUFFICIENT_FUNDS`);
          return;
        }
        if (code === 'VALIDATION') {
          setServerError('Please check the amount, method and account fields.');
          setServerDetail(`HTTP 400 · VALIDATION`);
          return;
        }
        setServerError(message ?? code ?? 'Could not submit withdrawal.');
        setServerDetail(`HTTP ${res.status}${code ? ` · ${code}` : ''}`);
        return;
      }

      const newId = typeof data?.withdrawal === 'object' && data.withdrawal !== null
        ? (data.withdrawal as { id?: string }).id ?? null
        : null;
      if (!newId) {
        setServerError('Withdrawal was accepted but no reference id was returned. Please check /dashboard/transactions.');
        return;
      }
      setSubmittedId(newId);
      setSubmitted(true);
      triggerWalletRefresh();
    } catch (err) {
      setServerError('Network error. Please try again.');
      setServerDetail(err instanceof Error ? err.message : null);
    } finally {
      setLoading(false);
    }
  };

  const newRequest = () => {
    setSubmitted(false);
    setSubmittedId(null);
    setServerError(null);
    setServerDetail(null);
    reset({ amount: 0, method: DEFAULT_METHOD, account: '', holder: '' });
  };

  const balanceLabel = auth.kind === 'authed' ? formatBDT(auth.balance) : '-';
  const canSubmit = auth.kind === 'authed' && !loading;

  return (
    <>
      <PageHeader title={t('withdraw.title')} subtitle="Cash out is reviewed by admin before payout" icon={<ArrowUpToLine className="h-5 w-5" />} />

      {auth.kind === 'guest' ? (
        <Card padding="md" className="mb-4 border border-amber-300/60 bg-amber-50">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-5 w-5 text-amber-700" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">You must be logged in to submit a withdrawal.</p>
              <p className="text-xs text-amber-800">Sessions are required so the request can be attached to your account.</p>
            </div>
            <Link href="/?login=1" className="btn-yellow inline-flex h-9 items-center rounded-lg px-3 text-sm">
              <LogIn className="mr-1.5 h-4 w-4" /> Log in
            </Link>
          </div>
        </Card>
      ) : null}

      {submitted ? (
        <Card tone="elev" className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon/15 text-neon">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-ink-hi">Withdrawal request submitted</h2>
          <p className="mt-2 text-sm text-ink-mid">{t('withdraw.notice')}</p>
          {submittedId ? (
            <p className="mt-1 text-xs text-ink-lo">
              Reference: <code className="font-mono">{submittedId}</code>
            </p>
          ) : null}
          <Button className="mt-6" variant="neon" onClick={newRequest}>New Request</Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6" noValidate>
            <Card padding="lg">
              <CardHeader title="Amount" subtitle={`${t('withdraw.balance')}: ${balanceLabel}`} />
              <div className="mb-4 flex flex-wrap gap-2">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setValue('amount', q, { shouldValidate: true })}
                    className="rounded-pill border border-neon/15 bg-base-deep/40 px-4 py-1.5 text-sm text-ink-mid transition hover:border-neon/40 hover:text-ink-hi"
                  >
                    ৳ {q.toLocaleString()}
                  </button>
                ))}
              </div>
              <FormField label={t('withdraw.amount')} required error={errors.amount?.message}>
                <Input type="number" min={500} step={100} {...register('amount')} placeholder="500" invalid={!!errors.amount} />
              </FormField>
            </Card>

            <Card padding="lg">
              <CardHeader title={t('withdraw.method')} />
              <FormField label={t('withdraw.method')} required error={errors.method?.message}>
                <Select {...register('method')} invalid={!!errors.method}>
                  {mockPaymentMethods.map((m) => (
                    <option key={m.id} value={m.name}>{m.name}</option>
                  ))}
                </Select>
              </FormField>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <FormField label={t('withdraw.account')} required error={errors.account?.message}>
                  <Input placeholder="01XXXXXXXXX" {...register('account')} invalid={!!errors.account} />
                </FormField>
                <FormField label={t('withdraw.holder')} required error={errors.holder?.message}>
                  <Input placeholder="Full name on account" {...register('holder')} invalid={!!errors.holder} />
                </FormField>
              </div>
            </Card>

            {isSubmitted && errorEntries.length > 0 ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> Please fix the highlighted fields:
                </p>
                <ul className="mt-1 list-disc pl-6">
                  {errorEntries.map((e) => (
                    <li key={e.field}><span className="capitalize">{e.field}</span> - {e.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {serverError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <p className="font-semibold">{serverError}</p>
                {serverDetail ? <p className="mt-0.5 text-xs text-red-700/80">{serverDetail}</p> : null}
              </div>
            ) : null}

            <Button type="submit" size="lg" loading={loading} disabled={!canSubmit} className="w-full md:w-auto">
              {t('withdraw.submit')}
            </Button>
          </form>

          <aside className="space-y-4">
            <Card tone="elev" padding="lg">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-hi">
                <ShieldCheck className="h-4 w-4 text-neon" /> Admin Approval
              </h3>
              <p className="mt-2 text-sm text-ink-mid">{t('withdraw.notice')}</p>
            </Card>
            <Card padding="md">
              <h4 className="text-sm font-semibold text-ink-hi">Limits</h4>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-mid">
                <li>Minimum withdrawal: ৳ 500</li>
                <li>Maximum per request: ৳ 200,000</li>
                <li>Standard review window: under 30 minutes</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
