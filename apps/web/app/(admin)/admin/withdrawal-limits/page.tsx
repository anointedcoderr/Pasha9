// Built by Anointed Coder.
//
// Global withdrawal limits + payout policy notes. Stored as
// SystemSetting rows so the /api/withdrawals submit endpoint and the
// public /withdraw page both read the same values. Per-method limits
// live on /admin/payment-methods.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Settings, ArrowRight, Save, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface SettingRow { key: string; value: string }

const KEYS = ['withdrawal_min_amount', 'withdrawal_max_amount', 'withdrawal_policy_note'] as const;

export default function AdminWithdrawalLimitsPage() {
  const [minAmount, setMinAmount] = useState('500');
  const [maxAmount, setMaxAmount] = useState('200000');
  const [policyNote, setPolicyNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      const map = new Map<string, string>((data.settings as SettingRow[]).map((s) => [s.key, s.value ?? '']));
      setMinAmount(map.get('withdrawal_min_amount') ?? '500');
      setMaxAmount(map.get('withdrawal_max_amount') ?? '200000');
      setPolicyNote(map.get('withdrawal_policy_note') ?? '');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          updates: [
            { key: 'withdrawal_min_amount', value: minAmount.trim() },
            { key: 'withdrawal_max_amount', value: maxAmount.trim() },
            { key: 'withdrawal_policy_note', value: policyNote.trim() },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Save failed');
      setToast(`Saved (${data.updated ?? KEYS.length} updates). Limits apply on the next /withdraw submission.`);
      setTimeout(() => setToast(null), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Withdrawal Limits"
        subtitle="Global min / max per request + policy note shown to users on the withdraw form."
        icon={<Settings className="h-5 w-5" />}
        action={
          <div className="flex gap-2">
            <Link href="/admin/payment-methods" className="btn-gold inline-flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-ink">
              Per-method limits <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />} onClick={load}>
              Reload
            </Button>
          </div>
        }
      />

      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}
      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}

      <Card padding="lg">
        <CardHeader title="Global limits" subtitle="These caps apply BEFORE any per-method limits configured on Payment Methods." />
        {loading ? (
          <p className="text-sm text-ink-mid">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Minimum withdrawal (BDT)" hint="Smaller submissions return BELOW_MIN. Default 500.">
                <Input type="number" min="0" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              </FormField>
              <FormField label="Maximum withdrawal (BDT) per request" hint="Larger submissions return ABOVE_MAX. Default 200000.">
                <Input type="number" min="0" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              </FormField>
            </div>
            <FormField label="Policy note (shown to users on /withdraw)" hint="Plain text. Use sparingly; appears in the Tips card.">
              <Textarea rows={3} value={policyNote} onChange={(e) => setPolicyNote(e.target.value)} placeholder="Withdrawals are reviewed by admin within 30 minutes. Turnover rules may apply." />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="gold" loading={saving} leftIcon={<Save className="h-3.5 w-3.5" />} onClick={save}>Save Limits</Button>
            </div>
          </div>
        )}
      </Card>

      <Card padding="md" className="mt-4">
        <p className="text-xs text-ink-mid">
          Daily / weekly aggregate caps + per-user KYC thresholds are scheduled for the M2 Security pass. The
          current submit path enforces the global min / max here PLUS each method&apos;s individual cap from
          {' '}<Link href="/admin/payment-methods" className="text-gold-300 hover:underline">Payment Methods</Link>.
        </p>
      </Card>
    </>
  );
}
