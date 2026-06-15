'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { withdrawalSchema, type WithdrawalInput } from '@/lib/utils/validation';
import { useT, useLang } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { AlertTriangle, CheckCircle2, Lock, LogIn } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';
import { DepositWithdrawTabs } from '@/components/wallet/DepositWithdrawTabs';
import { PaymentMethodPicker } from '@/components/wallet/PaymentMethodPicker';
import { SelectedMethodCard } from '@/components/wallet/SelectedMethodCard';

const QUICK = [500, 1000, 2500, 5000, 10000];

type AuthState =
  | { kind: 'checking' }
  | { kind: 'guest' }
  | { kind: 'authed'; username: string; balance: number };

interface PayoutMethod {
  id: string;
  name: string;
  type: string;
  number: string | null;
  iconUrl: string | null;
  bannerUrl: string | null;
  instruction: string | null;
  instructionBn: string | null;
  payoutInstruction: string | null;
  payoutInstructionBn: string | null;
  minWithdrawal: number | null;
  maxWithdrawal: number | null;
}

interface GlobalLimits {
  min: number;
  max: number;
  policy: string;
}

interface TurnoverState {
  loaded: boolean;
  isMet: boolean;
  multiplier: number;
  requiredTurnover: number;
  completedTurnover: number;
  remainingTurnover: number;
  depositRequired: number;
  depositCompleted: number;
  depositRemaining: number;
  bettingPassRequired: number;
  bettingPassCompleted: number;
  bettingPassRemaining: number;
  referralRequired: number;
  referralCompleted: number;
  referralRemaining: number;
  bdtBalanceLocked: number;
  referralBalanceLocked: number;
}

const DEFAULT_LIMITS: GlobalLimits = { min: 500, max: 200000, policy: '' };
const DEFAULT_TURNOVER: TurnoverState = {
  loaded: false,
  isMet: true,
  multiplier: 1,
  requiredTurnover: 0,
  completedTurnover: 0,
  remainingTurnover: 0,
  depositRequired: 0,
  depositCompleted: 0,
  depositRemaining: 0,
  bettingPassRequired: 0,
  bettingPassCompleted: 0,
  bettingPassRemaining: 0,
  referralRequired: 0,
  referralCompleted: 0,
  referralRemaining: 0,
  bdtBalanceLocked: 0,
  referralBalanceLocked: 0,
};

export default function WithdrawPage() {
  const t = useT();
  const { lang } = useLang();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverDetail, setServerDetail] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [auth, setAuth] = useState<AuthState>({ kind: 'checking' });
  const [methods, setMethods] = useState<PayoutMethod[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(true);
  const [limits, setLimits] = useState<GlobalLimits>(DEFAULT_LIMITS);
  const [turnover, setTurnover] = useState<TurnoverState>(DEFAULT_TURNOVER);

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

  useEffect(() => {
    let alive = true;
    fetch('/api/content/payment-methods', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        const payout = Array.isArray(data?.payout) ? (data.payout as PayoutMethod[]) : [];
        setMethods(payout);
      })
      .catch(() => { if (alive) setMethods([]); })
      .finally(() => { if (alive) setMethodsLoading(false); });

    fetch('/api/content/withdrawal-limits', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive) return;
        if (data && typeof data === 'object') {
          setLimits({
            min: Number(data.min ?? DEFAULT_LIMITS.min) || DEFAULT_LIMITS.min,
            max: Number(data.max ?? DEFAULT_LIMITS.max) || DEFAULT_LIMITS.max,
            policy: typeof data.policy === 'string' ? data.policy : '',
          });
        }
      })
      .catch(() => { /* keep defaults */ });

    return () => { alive = false; };
  }, []);

  // Refresh turnover eligibility whenever auth resolves to a real
  // session and on every wallet-refresh event so a fresh bet updates
  // the warning without a hard reload.
  useEffect(() => {
    if (auth.kind !== 'authed') {
      setTurnover(DEFAULT_TURNOVER);
      return;
    }
    let alive = true;
    const probe = () => {
      fetch('/api/withdrawals/eligibility', { cache: 'no-store', credentials: 'include' })
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!alive || !data) return;
          setTurnover({
            loaded: true,
            isMet: Boolean(data.isMet),
            multiplier: Number(data.multiplier ?? 1),
            requiredTurnover: Number(data.requiredTurnover ?? 0),
            completedTurnover: Number(data.completedTurnover ?? 0),
            remainingTurnover: Number(data.remainingTurnover ?? 0),
            depositRequired: Number(data.depositRequired ?? 0),
            depositCompleted: Number(data.depositCompleted ?? 0),
            depositRemaining: Number(data.depositRemaining ?? 0),
            bettingPassRequired: Number(data.bettingPassRequired ?? 0),
            bettingPassCompleted: Number(data.bettingPassCompleted ?? 0),
            bettingPassRemaining: Number(data.bettingPassRemaining ?? 0),
            referralRequired: Number(data.referralRequired ?? 0),
            referralCompleted: Number(data.referralCompleted ?? 0),
            referralRemaining: Number(data.referralRemaining ?? 0),
            bdtBalanceLocked: Number(data.bdtBalanceLocked ?? 0),
            referralBalanceLocked: Number(data.referralBalanceLocked ?? 0),
          });
        })
        .catch(() => { /* keep defaults */ });
    };
    probe();
    const handler = () => probe();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => {
      alive = false;
      window.removeEventListener('pasha9:wallet-refresh', handler);
    };
  }, [auth.kind]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitted },
  } = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, method: '', account: '', holder: '' },
    shouldUnregister: false,
  });

  // Once live methods load, default the form to the first one so the
  // user does not have to manually open the dropdown.
  useEffect(() => {
    if (methods.length > 0 && !watch('method')) {
      setValue('method', methods[0].name, { shouldValidate: false });
    }
  }, [methods, setValue, watch]);

  const selectedMethod = useMemo(
    () => methods.find((m) => m.name === watch('method')) ?? null,
    [methods, watch],
  );

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
          // accountName is no longer collected from the public form
          // after the Babu88-style redesign; the API defaults to "-"
          // when omitted so admin tooling still gets a string.
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
          setServerDetail('HTTP 400 . INSUFFICIENT_FUNDS');
          return;
        }
        if (code === 'TURNOVER_NOT_MET') {
          setServerError(message ?? 'Your turnover requirement has not been completed yet.');
          setServerDetail('HTTP 403 . TURNOVER_NOT_MET');
          // Re-fetch eligibility so the on-page warning reflects the
          // server-side numbers used in the rejection.
          fetch('/api/withdrawals/eligibility', { cache: 'no-store', credentials: 'include' })
            .then((r) => (r.ok ? r.json() : null))
            .then((data) => {
              if (!data) return;
              setTurnover({
                loaded: true,
                isMet: Boolean(data.isMet),
                multiplier: Number(data.multiplier ?? 1),
                requiredTurnover: Number(data.requiredTurnover ?? 0),
                completedTurnover: Number(data.completedTurnover ?? 0),
                remainingTurnover: Number(data.remainingTurnover ?? 0),
                depositRequired: Number(data.depositRequired ?? 0),
                depositCompleted: Number(data.depositCompleted ?? 0),
                depositRemaining: Number(data.depositRemaining ?? 0),
                bettingPassRequired: Number(data.bettingPassRequired ?? 0),
                bettingPassCompleted: Number(data.bettingPassCompleted ?? 0),
                bettingPassRemaining: Number(data.bettingPassRemaining ?? 0),
                referralRequired: Number(data.referralRequired ?? 0),
                referralCompleted: Number(data.referralCompleted ?? 0),
                referralRemaining: Number(data.referralRemaining ?? 0),
                bdtBalanceLocked: Number(data.bdtBalanceLocked ?? 0),
                referralBalanceLocked: Number(data.referralBalanceLocked ?? 0),
              });
            })
            .catch(() => { /* keep current */ });
          return;
        }
        if (code === 'BELOW_MIN' || code === 'ABOVE_MAX' || code === 'METHOD_BELOW_MIN' || code === 'METHOD_ABOVE_MAX' || code === 'METHOD_PAYOUT_DISABLED') {
          setServerError(message ?? 'Amount or method is not allowed.');
          setServerDetail(`HTTP 400 . ${code}`);
          return;
        }
        if (code === 'VALIDATION') {
          setServerError('Please check the amount, method and account fields.');
          setServerDetail('HTTP 400 . VALIDATION');
          return;
        }
        setServerError(message ?? code ?? 'Could not submit withdrawal.');
        setServerDetail(`HTTP ${res.status}${code ? ` . ${code}` : ''}`);
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
    reset({ amount: 0, method: methods[0]?.name ?? '', account: '', holder: '' });
  };

  const balanceLabel = auth.kind === 'authed' ? formatBDT(auth.balance) : '-';
  const turnoverBlocks = turnover.loaded && !turnover.isMet;
  const canSubmit = auth.kind === 'authed' && !loading && methods.length > 0 && !turnoverBlocks;

  // Respect the operator's choice. When the per-method PaymentMethod
  // row carries an explicit min/max, that wins (operator opted into a
  // method-specific override). When it does not, the global
  // SystemSetting limits.min / limits.max from /admin/withdrawal-limits
  // are used directly. The previous Math.max/Math.min logic ignored
  // the global setting whenever the per-method row had a higher
  // hardcoded value left over from the seed - which is why operators
  // saw "Minimum 500 BDT" after lowering the global to 100.
  const effectiveMin = selectedMethod?.minWithdrawal != null
    ? selectedMethod.minWithdrawal
    : limits.min;
  const effectiveMax = selectedMethod?.maxWithdrawal != null
    ? selectedMethod.maxWithdrawal
    : limits.max;

  return (
    <>
      <DepositWithdrawTabs active="withdraw" />

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

      {turnoverBlocks ? (
        <Card padding="md" className="mb-4 border-l-4 border-rose-500 bg-rose-50">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-rose-600" />
            <div className="flex-1">
              <p className="text-sm font-bold text-rose-900">
                {lang === 'bn'
                  ? 'আপনার টার্নওভার সম্পূর্ণ হয়নি।'
                  : 'Your turnover requirement has not been completed yet.'}
              </p>
              <p className="mt-1 text-xs text-rose-800">
                {lang === 'bn'
                  ? `উইথড্রয়াল রিকোয়েস্ট জমা দেওয়ার আগে আরও ৳ ${turnover.remainingTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })} টার্নওভার সম্পূর্ণ করুন।`
                  : `You need to complete ৳ ${turnover.remainingTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })} more turnover before you can submit a withdrawal request.`}
              </p>
              <div className="mt-2 grid gap-1 text-[11px] text-rose-900 sm:grid-cols-3">
                <div className="rounded-md bg-white/50 px-2 py-1">
                  <span className="block font-bold uppercase tracking-wider text-rose-700">{lang === 'bn' ? 'প্রয়োজনীয়' : 'Required'}</span>
                  ৳ {turnover.requiredTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="rounded-md bg-white/50 px-2 py-1">
                  <span className="block font-bold uppercase tracking-wider text-rose-700">{lang === 'bn' ? 'সম্পূর্ণ' : 'Completed'}</span>
                  ৳ {turnover.completedTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className="rounded-md bg-white/50 px-2 py-1">
                  <span className="block font-bold uppercase tracking-wider text-rose-700">{lang === 'bn' ? 'বাকি' : 'Remaining'}</span>
                  ৳ {turnover.remainingTurnover.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
              </div>

              {turnover.bettingPassRequired > 0 ? (
                <div className="mt-3 rounded-md border border-rose-300/60 bg-white/70 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    {lang === 'bn' ? 'বেটিং পাস রিওয়ার্ড টার্নওভার' : 'Betting Pass reward turnover'}
                  </p>
                  <p className="mt-1 text-[11px] text-rose-900">
                    {lang === 'bn'
                      ? `প্রয়োজন ৳ ${turnover.bettingPassRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . সম্পূর্ণ ৳ ${turnover.bettingPassCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . বাকি ৳ ${turnover.bettingPassRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`
                      : `Required ৳ ${turnover.bettingPassRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Completed ৳ ${turnover.bettingPassCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Remaining ৳ ${turnover.bettingPassRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`}
                  </p>
                </div>
              ) : null}

              {turnover.depositRequired > 0 ? (
                <div className="mt-2 rounded-md border border-rose-200/60 bg-white/50 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    {lang === 'bn' ? 'ডিপোজিট টার্নওভার' : 'Deposit turnover'}
                  </p>
                  <p className="mt-1 text-[11px] text-rose-900">
                    {lang === 'bn'
                      ? `প্রয়োজন ৳ ${turnover.depositRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . সম্পূর্ণ ৳ ${turnover.depositCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . বাকি ৳ ${turnover.depositRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`
                      : `Required ৳ ${turnover.depositRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Completed ৳ ${turnover.depositCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Remaining ৳ ${turnover.depositRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`}
                  </p>
                </div>
              ) : null}

              {turnover.referralRequired > 0 ? (
                <div className="mt-2 rounded-md border border-rose-200/60 bg-white/50 p-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
                    {lang === 'bn' ? 'রেফারেল রিওয়ার্ড টার্নওভার' : 'Referral reward turnover'}
                  </p>
                  <p className="mt-1 text-[11px] text-rose-900">
                    {lang === 'bn'
                      ? `প্রয়োজন ৳ ${turnover.referralRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . সম্পূর্ণ ৳ ${turnover.referralCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . বাকি ৳ ${turnover.referralRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`
                      : `Required ৳ ${turnover.referralRequired.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Completed ৳ ${turnover.referralCompleted.toLocaleString(undefined, { maximumFractionDigits: 2 })} . Remaining ৳ ${turnover.referralRemaining.toLocaleString(undefined, { maximumFractionDigits: 2 })}.`}
                  </p>
                </div>
              ) : null}
            </div>
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
        <div className="mx-auto w-full max-w-2xl pb-24">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
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
                    {`৳ ${q.toLocaleString()}`}
                  </button>
                ))}
              </div>
              <FormField
                label={t('withdraw.amount')}
                required
                hint={`Allowed for this method: ৳ ${effectiveMin.toLocaleString()} - ৳ ${effectiveMax.toLocaleString()}`}
                error={errors.amount?.message}
              >
                <Input type="number" min={effectiveMin} max={effectiveMax} step={100} {...register('amount')} placeholder={String(effectiveMin)} invalid={!!errors.amount} />
              </FormField>
            </Card>

            <Card padding="lg">
              <CardHeader
                title={t('withdraw.method')}
                subtitle={methodsLoading
                  ? (lang === 'bn' ? 'পেআউট চ্যানেল লোড হচ্ছে...' : 'Loading payout channels...')
                  : `${methods.length} ${lang === 'bn' ? 'অ্যাক্টিভ পেআউট চ্যানেল' : `active payout channel${methods.length === 1 ? '' : 's'}`}`}
              />
              {methods.length === 0 ? (
                <p className="text-sm text-ink-mid">{lang === 'bn' ? 'কোনো পেআউট চ্যানেল উপলব্ধ নেই।' : 'No payout channels available.'}</p>
              ) : (
                <PaymentMethodPicker
                  methods={methods.map((m) => ({ id: m.id, name: m.name, type: m.type, iconUrl: m.iconUrl }))}
                  selectedName={watch('method') ?? ''}
                  onSelect={(name) => setValue('method', name, { shouldValidate: true })}
                />
              )}
              {selectedMethod ? (
                <SelectedMethodCard
                  mode="withdraw"
                  showCopy={false}
                  className="mt-4"
                  method={{
                    id: selectedMethod.id,
                    name: selectedMethod.name,
                    type: selectedMethod.type,
                    number: selectedMethod.number,
                    iconUrl: selectedMethod.iconUrl,
                    bannerUrl: selectedMethod.bannerUrl,
                    instruction: selectedMethod.instruction,
                    instructionBn: selectedMethod.instructionBn,
                    payoutInstruction: selectedMethod.payoutInstruction,
                    payoutInstructionBn: selectedMethod.payoutInstructionBn,
                  }}
                />
              ) : null}
              <div className="mt-4">
                <FormField label={t('withdraw.account')} required error={errors.account?.message}>
                  <Input placeholder="01XXXXXXXXX" {...register('account')} invalid={!!errors.account} />
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
        </div>
      )}
    </>
  );
}
