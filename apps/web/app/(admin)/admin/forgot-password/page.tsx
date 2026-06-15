// Built by Anointed Coder.
//
// Admin console for the Firebase Phone Auth Forgot Password flow.
// Shows the SystemSetting flag, server-side Firebase Admin SDK status,
// and a one-click toggle. The toggle is the only thing operators need
// to flip after Firebase keys land in .env; the rest of the wiring is
// hands-off.

'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/site/PageHeader';
import { Card } from '@/components/ui/Card';
import { Switch } from '@/components/ui/Switch';
import { Chip } from '@/components/ui/Chip';
import { KeyRound, ShieldCheck, AlertTriangle, RefreshCw, ArrowRight } from 'lucide-react';

interface Status {
  enabled: boolean;
  adminSdkConfigured: boolean;
}

export default function AdminForgotPasswordPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/admin/forgot-password', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Failed to load');
      setStatus({ enabled: !!data.enabled, adminSdkConfigured: !!data.adminSdkConfigured });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onToggle = async (next: boolean) => {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/forgot-password', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code ?? 'Toggle failed');
      setStatus((s) => (s ? { ...s, enabled: next } : s));
      setSavedAt(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Toggle failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Forgot Password (SMS)"
        subtitle="Self-service Forgot Password via Firebase Phone Auth. Players prove ownership of their registered phone with a Firebase-delivered SMS code, then set a new password. All other sessions are revoked on reset."
        icon={<KeyRound className="h-5 w-5" />}
        action={
          <button
            type="button"
            onClick={refresh}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-divider bg-brand-surface px-3 text-xs font-bold uppercase tracking-wider text-brand-ink hover:bg-brand-paper"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      {error ? (
        <Card padding="md" className="mb-4 border-l-4 border-rose-500">
          <p className="text-sm text-rose-300">
            <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
            {error}
          </p>
        </Card>
      ) : null}

      {!status ? (
        <Card padding="lg">Loading...</Card>
      ) : (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-wrap items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-500/15 text-gold-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-bold text-brand-ink">Server-side Firebase Admin SDK</p>
                  <Chip tone={status.adminSdkConfigured ? 'ok' : 'warn'}>
                    {status.adminSdkConfigured ? 'configured' : 'missing'}
                  </Chip>
                </div>
                <p className="mt-1 text-xs text-brand-inkSoft">
                  Set <code className="font-mono">FIREBASE_PROJECT_ID</code>,
                  {' '}<code className="font-mono">FIREBASE_CLIENT_EMAIL</code> and
                  {' '}<code className="font-mono">FIREBASE_PRIVATE_KEY</code> in the production env file. After
                  editing the env, restart pm2: <code className="font-mono">pm2 restart pasha9-web --update-env</code>.
                </p>
                {!status.adminSdkConfigured ? (
                  <p className="mt-2 text-xs text-amber-300">
                    Flipping the toggle below while the Admin SDK env is missing will fail with FORGOT_DISABLED on every verify call.
                  </p>
                ) : null}
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-ink">Enable for players</p>
                <p className="mt-1 text-xs text-brand-inkSoft">
                  When ON, the /forgot-password page shows the 3-step SMS reset (phone, SMS code, new password).
                  When OFF, the page falls back to the admin-assisted flow.
                </p>
                {savedAt ? (
                  <p className="mt-1 text-[11px] text-emerald-300">Saved at {savedAt.toLocaleTimeString()}.</p>
                ) : null}
              </div>
              <Switch checked={status.enabled} onChange={onToggle} disabled={busy} />
            </div>
          </Card>

          <Card padding="md" className="bg-brand-surface/40">
            <p className="text-xs text-brand-inkSoft">
              <strong>Recommended rollout:</strong> verify Firebase is wired by signing in to a test account, opening
              <code className="font-mono"> /forgot-password</code> in an incognito window with the flag OFF for everyone
              else, manually setting <code className="font-mono">forgot_password_enabled=1</code> for your own session
              first, then flipping the toggle on for production once the test phone receives an SMS and resets cleanly.
            </p>
            <p className="mt-2 text-xs text-brand-inkSoft">
              Audit log: <Link href="/admin/security" className="font-semibold text-brand-blue-600 hover:text-brand-blue-700">/admin/security <ArrowRight className="inline h-3 w-3" /></Link>
              {' '}- filter on actions <code className="font-mono">FORGOT_PHONE_VERIFY_OK</code>,
              {' '}<code className="font-mono">FORGOT_PHONE_VERIFY_FAIL</code>,
              {' '}<code className="font-mono">FORGOT_PHONE_RESET_OK</code>.
            </p>
          </Card>
        </div>
      )}
    </>
  );
}
