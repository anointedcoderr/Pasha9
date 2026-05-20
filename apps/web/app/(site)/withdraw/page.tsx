'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/site/PageHeader';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { withdrawalSchema, type WithdrawalInput } from '@/lib/utils/validation';
import { mockPaymentMethods } from '@/lib/mock/payment-methods';
import { currentUser } from '@/lib/mock/users';
import { useT } from '@/lib/i18n/context';
import { ArrowUpToLine, CheckCircle2, ShieldCheck } from 'lucide-react';
import { formatBDT } from '@/lib/utils/format';

const QUICK = [500, 1000, 2500, 5000, 10000];

export default function WithdrawPage() {
  const t = useT();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<WithdrawalInput>({
    resolver: zodResolver(withdrawalSchema),
    defaultValues: { amount: 0, method: mockPaymentMethods[0]?.name ?? '', account: '', holder: '' },
  });

  const onSubmit = async () => {
    setLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <>
      <PageHeader title={t('withdraw.title')} subtitle="Cash out is reviewed by admin before payout" icon={<ArrowUpToLine className="h-5 w-5" />} />

      {submitted ? (
        <Card tone="elev" className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon/15 text-neon">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-ink-hi">Withdrawal request submitted</h2>
          <p className="mt-2 text-sm text-ink-mid">{t('withdraw.notice')}</p>
          <Button className="mt-6" variant="neon" onClick={() => setSubmitted(false)}>New Request</Button>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
            <Card padding="lg">
              <CardHeader title="Amount" subtitle={`${t('withdraw.balance')}: ${formatBDT(currentUser.balance)}`} />
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

            <Button type="submit" size="lg" loading={loading} className="w-full md:w-auto">
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
