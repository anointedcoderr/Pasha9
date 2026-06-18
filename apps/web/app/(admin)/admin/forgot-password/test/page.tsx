// Built by Anointed Coder.
//
// /admin/forgot-password/test - live diagnostic for the Firebase
// Phone Auth flow. Operator types a phone number, taps Run, and sees
// pass/fail on every gate that could block the flow:
//
//  . SystemSetting flag forgot_password_enabled
//  . FIREBASE_* env on the server
//  . NEXT_PUBLIC_FIREBASE_* env on the client (presence only)
//  . Phone is a valid BD mobile + matches a real user
//  . Last 24h ActivityLog counts for VERIFY_OK / FAIL / NO_USER /
//    BLOCKED / RESET_OK so the operator can tell whether anyone is
//    actually hitting the endpoint
//
// Includes a curl one-liner the operator can run on their phone to
// hit the verify endpoint with an arbitrary phone number, useful
// when they have a Firebase ID token from manual testing.

'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Chip } from '@/components/ui/Chip';
import { CheckCircle2, AlertCircle, KeyRound, ArrowRight, Phone } from 'lucide-react';

interface Check { name: string; ok: boolean; hint: string }
interface PhoneCheck {
  ok: boolean;
  reason: string;
  e164?: string;
  userFound?: boolean;
}
interface Diagnostic {
  overallOk: boolean;
  flagOn: boolean;
  adminConfigured: boolean;
  adminEnv: Record<string, boolean>;
  publicEnv: Record<string, boolean>;
  checks: Check[];
  phoneCheck: PhoneCheck | null;
  activity24h: {
    verifyOk: number;
    verifyFail: number;
    verifyNoUser: number;
    verifyBlocked: number;
    resetOk: number;
  };
  nextSteps: string[];
}

export default function ForgotPasswordTestPage() {
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Diagnostic | null>(null);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/admin/forgot-password/diagnose', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() || undefined }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.message ?? j?.code ?? 'Failed');
      setResult(j as Diagnostic);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setBusy(false);
    }
  }, [phone]);

  return (
    <>
      <PageHeader
        title="Forgot Password Diagnostic"
        subtitle="Live check on every gate that could block the Firebase Phone Auth flow. Run any time SMS codes are not arriving."
        icon={<KeyRound className="h-5 w-5" />}
        action={
          <Link href="/admin/forgot-password" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper">
            Toggle <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <Card padding="lg" className="mb-4">
        <CardHeader
          title="Run diagnostic"
          subtitle="Optionally include a phone number to check whether it maps to a real user."
        />
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[260px] flex-1">
            <FormField label="Phone (optional)">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-inkMute" />
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="01XXXXXXXXX" className="pl-9" />
              </div>
            </FormField>
          </div>
          <div className="flex items-end">
            <Button variant="gold" loading={busy} onClick={run}>Run diagnostic</Button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300"><AlertCircle className="mr-1 inline h-3.5 w-3.5" />{error}</p> : null}
      </Card>

      {result ? (
        <>
          <Card padding="lg" className={result.overallOk ? 'mb-4 border border-emerald-400/40 bg-emerald-500/10' : 'mb-4 border border-amber-400/40 bg-amber-500/10'}>
            <p className="inline-flex items-center gap-2 text-base font-bold">
              {result.overallOk ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-emerald-200">All gates pass. The flow is ready end-to-end.</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-300" />
                  <span className="text-amber-200">One or more gates blocked the flow. See checks below.</span>
                </>
              )}
            </p>
          </Card>

          <Card padding="lg" className="mb-4">
            <CardHeader title="Gates" />
            <ul className="space-y-2">
              {result.checks.map((c) => (
                <li key={c.name} className="flex items-start gap-3 rounded-xl border border-brand-divider bg-brand-paper p-3">
                  <Chip tone={c.ok ? 'ok' : 'warn'}>{c.ok ? 'PASS' : 'FAIL'}</Chip>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-brand-ink">{c.name}</p>
                    <p className="text-xs text-brand-inkMute">{c.hint}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          {result.phoneCheck ? (
            <Card padding="lg" className="mb-4">
              <CardHeader title="Phone check" />
              <div className="flex items-start gap-3 rounded-xl border border-brand-divider bg-brand-paper p-3">
                <Chip tone={result.phoneCheck.ok ? 'ok' : 'warn'}>{result.phoneCheck.ok ? 'MATCH' : 'NO MATCH'}</Chip>
                <div className="flex-1">
                  <p className="text-sm text-brand-ink">{result.phoneCheck.reason}</p>
                  {result.phoneCheck.e164 ? <p className="mt-1 text-[11px] text-brand-inkMute">Normalised E.164: <code className="font-mono">{result.phoneCheck.e164}</code></p> : null}
                </div>
              </div>
            </Card>
          ) : null}

          <Card padding="lg" className="mb-4">
            <CardHeader title="Last 24h activity" subtitle="If everything is set up correctly but VERIFY_OK is 0 and VERIFY_FAIL is 0, no user has even attempted the flow yet." />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Metric label="Verify OK" value={result.activity24h.verifyOk} tone="ok" />
              <Metric label="Verify fail" value={result.activity24h.verifyFail} tone={result.activity24h.verifyFail > 0 ? 'warn' : 'neutral'} />
              <Metric label="No user" value={result.activity24h.verifyNoUser} tone="neutral" />
              <Metric label="Blocked" value={result.activity24h.verifyBlocked} tone={result.activity24h.verifyBlocked > 0 ? 'warn' : 'neutral'} />
              <Metric label="Reset OK" value={result.activity24h.resetOk} tone="ok" />
            </div>
          </Card>

          <Card padding="lg" className="mb-4">
            <CardHeader title="Next steps" />
            <ol className="list-inside list-decimal space-y-1 text-sm text-brand-ink">
              {result.nextSteps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </Card>

          <Card padding="lg">
            <CardHeader title="Server env presence" subtitle="Boolean presence only - values are never echoed back so the page is safe to share." />
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">Server (Admin SDK)</p>
                <ul className="mt-1 space-y-1 text-xs text-brand-ink">
                  {Object.entries(result.adminEnv).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-2 rounded border border-brand-divider px-2 py-1">
                      <code className="font-mono">{k}</code>
                      <Chip tone={v ? 'ok' : 'warn'}>{v ? 'set' : 'missing'}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-brand-inkMute">Client (Web SDK)</p>
                <ul className="mt-1 space-y-1 text-xs text-brand-ink">
                  {Object.entries(result.publicEnv).map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between gap-2 rounded border border-brand-divider px-2 py-1">
                      <code className="font-mono">{k}</code>
                      <Chip tone={v ? 'ok' : 'warn'}>{v ? 'set' : 'missing'}</Chip>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </>
      ) : null}
    </>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: 'ok' | 'warn' | 'neutral' }) {
  const toneClass = tone === 'ok' ? 'border-emerald-400/40 bg-emerald-500/10' : tone === 'warn' ? 'border-amber-400/40 bg-amber-500/10' : 'border-brand-divider bg-brand-paper';
  return (
    <div className={`rounded-xl border ${toneClass} p-3`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-inkMute">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tabular-nums text-brand-ink">{value}</p>
    </div>
  );
}
