'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PageHeader } from '@/components/site/PageHeader';
import { FormField, Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { depositSchema, type DepositInput } from '@/lib/utils/validation';
import { mockPaymentMethods } from '@/lib/mock/payment-methods';
import { useT } from '@/lib/i18n/context';
import { triggerWalletRefresh } from '@/components/site/WalletStrip';
import { ArrowDownToLine, CheckCircle2, Upload, Info } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';

const QUICK = [500, 1000, 2000, 5000, 10000, 25000];

export default function DepositPage() {
  const t = useT();
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submittedDepositId, setSubmittedDepositId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<DepositInput>({
    resolver: zodResolver(depositSchema),
    defaultValues: { amount: 0, method: mockPaymentMethods[0]?.name ?? '', txn: '' },
  });

  const method = mockPaymentMethods.find((m) => m.name === watch('method'));

  const onSubmit = async (values: DepositInput) => {
    setServerError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          amount: values.amount,
          method: values.method,
          transactionId: values.txn,
          // proofUrl wiring lives with the file upload backend - M1 ships
          // the filename to the admin via the admin note flow.
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401) {
          setServerError('Please log in before submitting a deposit.');
          router.push('/?login=1');
          return;
        }
        if (res.status === 429) {
          setServerError('Too many submissions. Please wait a minute and try again.');
          return;
        }
        if (data?.code === 'VALIDATION') {
          setServerError('Please check the amount, method and transaction ID.');
          return;
        }
        setServerError(data?.message ?? data?.code ?? 'Could not submit deposit.');
        return;
      }
      setSubmittedDepositId(data?.deposit?.id ?? null);
      setSubmitted(true);
      // Trigger a wallet refresh so any "pending" badges or counters
      // pick up the new row. Main balance will only change after
      // admin approval.
      triggerWalletRefresh();
    } catch {
      setServerError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const newRequest = () => {
    setSubmitted(false);
    setSubmittedDepositId(null);
    setFilename(null);
    setServerError(null);
    reset({ amount: 0, method: mockPaymentMethods[0]?.name ?? '', txn: '' });
  };

  return (
    <>
      <PageHeader title={t('deposit.title')} subtitle="Send funds, paste TX ID, upload proof, submit" icon={<ArrowDownToLine className="h-5 w-5" />} />

      {submitted ? (
        <Card tone="elev" className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-neon/15 text-neon">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-semibold text-ink-hi">Deposit request submitted</h2>
          <p className="mt-2 text-sm text-ink-mid">Your request is pending admin review. Balance and lottery tickets are credited after approval.</p>
          {submittedDepositId ? (
            <p className="mt-1 text-xs text-ink-lo">Reference: <code className="font-mono">{submittedDepositId}</code></p>
          ) : null}
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="neon" onClick={newRequest}>New Request</Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 space-y-6">
            <Card padding="lg">
              <CardHeader title="Amount" subtitle="Choose a preset or enter a custom value" />
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
              <FormField label={t('deposit.amount')} required error={errors.amount?.message}>
                <Input type="number" min={0} step={100} {...register('amount')} placeholder="500" invalid={!!errors.amount} />
              </FormField>
            </Card>

            <Card padding="lg">
              <CardHeader title={t('deposit.method')} subtitle="Pick how you sent the payment" />
              <div className="grid gap-3 md:grid-cols-3">
                {mockPaymentMethods.map((m) => {
                  const active = watch('method') === m.name;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setValue('method', m.name, { shouldValidate: true })}
                      className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                        active
                          ? 'border-neon/50 bg-neon/10 shadow-glow-neon'
                          : 'border-neon/15 bg-base-deep/40 hover:border-neon/30 hover:text-ink-hi'
                      }`}
                    >
                      <span className="text-sm font-semibold text-ink-hi">{m.name}</span>
                      <span className="text-xs text-ink-lo">{m.number}</span>
                    </button>
                  );
                })}
              </div>
              <Select className="mt-3 md:hidden" {...register('method')}>
                {mockPaymentMethods.map((m) => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </Select>
            </Card>

            <Card padding="lg">
              <CardHeader title="Verification" subtitle="Paste the TX ID and upload screenshot" />
              <div className="grid gap-4 md:grid-cols-2">
                <FormField label={t('deposit.txn')} required error={errors.txn?.message}>
                  <Input placeholder="TRX-3845921" {...register('txn')} invalid={!!errors.txn} />
                </FormField>
                <FormField label={t('deposit.proof')}>
                  <label className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-neon/25 bg-base-deep/40 px-3 text-sm text-ink-mid hover:border-neon/45 hover:text-ink-hi">
                    <Upload className="h-4 w-4" />
                    <span>{filename ?? 'Click to upload PNG, JPG, PDF'}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={(e) => setFilename(e.target.files?.[0]?.name ?? null)}
                    />
                  </label>
                </FormField>
              </div>
            </Card>

            {serverError ? (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{serverError}</p>
            ) : null}
            <Button type="submit" size="lg" loading={loading} className="w-full md:w-auto">
              {t('deposit.submit')}
            </Button>
          </form>

          <aside className="space-y-4">
            <Card tone="elev" padding="lg">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-hi">
                <Info className="h-4 w-4 text-neon" /> {t('deposit.instructions')}
              </h3>
              <p className="mt-2 text-sm text-ink-mid">{t('deposit.instructionsBody')}</p>
              {method ? (
                <div className="mt-4 space-y-2 rounded-xl border border-gold-500/25 bg-gold-500/5 p-3 text-sm">
                  <p className="text-xs uppercase tracking-wider text-gold-300">{method.name}</p>
                  <p className="font-mono text-ink-hi">{method.number}</p>
                  <p className="text-xs text-ink-mid">{method.instruction}</p>
                </div>
              ) : null}
            </Card>
            <Card padding="md">
              <h4 className="text-sm font-semibold text-ink-hi">Tips</h4>
              <ul className="mt-2 space-y-1.5 text-xs text-ink-mid">
                <li>Always double check the TX ID before submitting.</li>
                <li>Most requests are reviewed within 5 to 15 minutes.</li>
                <li>For urgent issues, use the Telegram or WhatsApp button.</li>
              </ul>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
