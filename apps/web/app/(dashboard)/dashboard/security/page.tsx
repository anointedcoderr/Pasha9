// Built by Anointed Coder.
//
// M2K user-side security panel. Wires real APIs:
//   GET  /api/auth/sessions       active devices + recent login attempts
//   DELETE /api/auth/sessions     revoke a specific device
//   POST /api/auth/2fa/setup      start TOTP enrollment (QR + otpauth)
//   POST /api/auth/2fa/verify     complete enrollment + return recovery codes
//   POST /api/auth/2fa/disable    turn 2FA off (requires current code)

'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { FormField, Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { Modal } from '@/components/ui/Modal';
import { ShieldCheck, Smartphone, History, RefreshCw, LogOut, KeyRound, ScanLine } from 'lucide-react';
import { useMe } from '@/lib/hooks/useMe';
import { cn } from '@/lib/utils/cn';

interface SessionRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
}
interface AttemptRow {
  id: string;
  ip: string | null;
  userAgent: string | null;
  success: boolean;
  reason: string | null;
  flags: string | null;
  surface: string;
  createdAt: string;
}

export default function SecurityPage() {
  const { me, refresh } = useMe();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 2FA state
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [disableModal, setDisableModal] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disabling, setDisabling] = useState(false);

  const flashToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 5000); };

  const loadSessions = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/auth/sessions', { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      setSessions(data.sessions as SessionRow[]);
      setAttempts(data.attempts as AttemptRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  const loadMe2fa = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' });
      const data = await res.json();
      if (res.ok) setTotpEnabled(Boolean(data?.user?.totpEnabled));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadSessions(); loadMe2fa(); }, [loadSessions, loadMe2fa]);

  const startEnroll = async () => {
    setEnrolling(true);
    setError(null);
    setRecoveryCodes(null);
    try {
      const res = await fetch('/api/auth/2fa/setup', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      setQrDataUrl(data.qrDataUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Setup failed');
    } finally { setEnrolling(false); }
  };

  const completeEnroll = async () => {
    if (!verifyCode.trim()) return;
    setVerifying(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      setRecoveryCodes(data.recoveryCodes as string[]);
      setQrDataUrl(null);
      setVerifyCode('');
      setTotpEnabled(true);
      flashToast('2FA enabled. Recovery codes shown below - copy them now, they are never shown again.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verify failed');
    } finally { setVerifying(false); }
  };

  const disable2fa = async () => {
    if (!disableCode.trim()) return;
    setDisabling(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      setTotpEnabled(false);
      setDisableModal(false);
      setDisableCode('');
      flashToast('2FA disabled. Re-enroll any time.');
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Disable failed');
    } finally { setDisabling(false); }
  };

  const revoke = async (id: string) => {
    if (!confirm('Sign out this device? You will need to log in again on that device.')) return;
    try {
      const res = await fetch('/api/auth/sessions', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message ?? data?.code);
      flashToast('Device signed out.');
      loadSessions();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Revoke failed');
    }
  };

  return (
    <>
      <PageHeader title="Account security" subtitle="Two-factor authentication, active devices, recent login attempts" icon={<ShieldCheck className="h-5 w-5" />} />

      {toast ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-ok">{toast}</p></Card> : null}
      {error ? <Card padding="md" className="mb-4"><p className="text-sm text-signal-danger">{error}</p></Card> : null}

      <Card padding="lg" className="mb-6">
        <CardHeader
          title="Two-factor authentication"
          subtitle={totpEnabled ? 'Enabled. You will be asked for a 6-digit code from your authenticator on every login.' : 'Off. Enable to require an authenticator code on every login.'}
          action={<Chip tone={totpEnabled ? 'ok' : 'warn'}>{totpEnabled ? 'enabled' : 'disabled'}</Chip>}
        />
        {!totpEnabled && !qrDataUrl ? (
          <Button variant="gold" leftIcon={<Smartphone className="h-4 w-4" />} loading={enrolling} onClick={startEnroll}>
            Enable 2FA
          </Button>
        ) : null}
        {qrDataUrl ? (
          <div className="grid gap-4 md:grid-cols-[220px_1fr]">
            <img src={qrDataUrl} alt="TOTP QR" width={220} height={220} className="rounded-xl border border-neon/10 bg-base-deep/40" />
            <div className="space-y-3">
              <p className="text-sm text-ink-mid">Scan this QR with Google Authenticator, Authy, 1Password or any TOTP app. Then enter the 6-digit code below to confirm.</p>
              <FormField label="Code from your authenticator" required>
                <Input value={verifyCode} onChange={(e) => setVerifyCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" />
              </FormField>
              <div className="flex gap-2">
                <Button variant="gold" leftIcon={<ScanLine className="h-4 w-4" />} loading={verifying} onClick={completeEnroll} disabled={verifyCode.length !== 6}>
                  Confirm + enable
                </Button>
                <Button variant="ghost" onClick={() => setQrDataUrl(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        ) : null}
        {recoveryCodes ? (
          <div className="mt-4 rounded-xl border border-signal-warn/30 bg-signal-warn/5 p-4">
            <p className="text-sm font-semibold text-ink-hi">Recovery codes . save these now</p>
            <p className="mt-1 text-xs text-ink-mid">Each code works exactly once if you lose your authenticator. Store them in a password manager or a printed copy. They are <b>never shown again</b>.</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {recoveryCodes.map((c) => <code key={c} className="rounded-lg border border-neon/10 bg-base-deep/60 px-2 py-1.5 text-center font-mono text-sm text-ink-hi">{c}</code>)}
            </div>
          </div>
        ) : null}
        {totpEnabled && !qrDataUrl ? (
          <div className="mt-4">
            <Button variant="ghost" leftIcon={<KeyRound className="h-4 w-4" />} onClick={() => setDisableModal(true)}>Disable 2FA</Button>
          </div>
        ) : null}
      </Card>

      <Card padding="lg" className="mb-6">
        <CardHeader
          title="Active devices"
          subtitle="Every device with a live session on your account. Sign out any device you do not recognise."
          action={<Button variant="ghost" leftIcon={<RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />} onClick={loadSessions}>Reload</Button>}
        />
        {loading ? <p className="text-sm text-ink-mid">Loading...</p> : sessions.length === 0 ? (
          <p className="text-sm text-ink-mid">No sessions on file.</p>
        ) : (
          <ul className="divide-y divide-neon/10">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <Chip tone={s.revokedAt ? 'neutral' : 'ok'}>{s.revokedAt ? 'revoked' : 'active'}</Chip>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-ink-mid" title={s.userAgent ?? ''}>{s.userAgent ?? 'unknown device'}</p>
                  <p className="text-xs text-ink-lo">
                    {s.ip ?? 'unknown ip'} . created {new Date(s.createdAt).toLocaleString()}{s.revokedAt ? ` . revoked ${new Date(s.revokedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                {!s.revokedAt ? (
                  <Button size="sm" variant="ghost" leftIcon={<LogOut className="h-3.5 w-3.5" />} onClick={() => revoke(s.id)}>Sign out</Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card padding="lg">
        <CardHeader title="Recent login attempts" subtitle="Last 30 attempts on your account, success and failed alike." />
        {attempts.length === 0 ? <p className="text-sm text-ink-mid">No recent attempts on file.</p> : (
          <table className="w-full text-sm">
            <thead className="text-xs uppercase tracking-wider text-ink-lo">
              <tr>
                <th className="px-2 py-2 text-left">When</th>
                <th className="px-2 py-2 text-left">IP</th>
                <th className="px-2 py-2 text-left">Result</th>
                <th className="px-2 py-2 text-left">Reason</th>
                <th className="px-2 py-2 text-left">Flags</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id} className="border-t border-neon/10">
                  <td className="px-2 py-2 text-xs text-ink-lo">{new Date(a.createdAt).toLocaleString()}</td>
                  <td className="px-2 py-2 font-mono text-xs">{a.ip ?? '-'}</td>
                  <td className="px-2 py-2"><Chip tone={a.success ? 'ok' : 'danger'}>{a.success ? 'ok' : 'fail'}</Chip></td>
                  <td className="px-2 py-2 text-xs text-ink-mid">{a.reason ?? '-'}</td>
                  <td className="px-2 py-2 text-xs text-ink-mid">{a.flags || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Modal open={disableModal} onOpenChange={setDisableModal} title="Disable 2FA" size="md">
        <p className="text-sm text-ink-mid">Enter your current 6-digit code OR one of your recovery codes to confirm.</p>
        <FormField label="Code" required>
          <Input value={disableCode} onChange={(e) => setDisableCode(e.target.value)} placeholder="123456 or recovery code" />
        </FormField>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDisableModal(false)}>Cancel</Button>
          <Button variant="danger" loading={disabling} onClick={disable2fa} disabled={!disableCode.trim()}>Disable</Button>
        </div>
      </Modal>
    </>
  );
}
