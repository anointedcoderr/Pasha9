// Built by Anointed Coder.
//
// Admin "My Account" page. Two focused cards:
//
//   1. Change password   wraps POST /api/auth/password
//                        (validates current + new + confirm; on
//                        success revokes all other sessions and the
//                        page redirects back to /admin/login)
//
//   2. Two-factor (TOTP) wraps the existing 2FA system already used
//                        by the player dashboard:
//                          POST /api/auth/2fa/setup    issue QR
//                          POST /api/auth/2fa/verify   confirm code
//                                                       + receive
//                                                       recovery codes
//                          POST /api/auth/2fa/disable  turn off
//
// The endpoints already authenticate via the cookie session and
// accept any user role, so wiring them for the super-admin login
// just means a fresh UI surface inside /admin/* without backend
// changes.

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/site/PageHeader';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { FormField, Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Chip } from '@/components/ui/Chip';
import {
  ShieldCheck, KeyRound, Smartphone, ScanLine, AlertTriangle,
  RefreshCw, LogOut, Copy, Download, Check,
} from 'lucide-react';

interface Toast { kind: 'ok' | 'err'; text: string }

export default function AdminAccountPage() {
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);

  // Password change card state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  // 2FA card state
  const [totpEnabled, setTotpEnabled] = useState<boolean | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [twofaError, setTwofaError] = useState<string | null>(null);

  // Disable 2FA modal state
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disableBusy, setDisableBusy] = useState(false);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    window.setTimeout(() => setToast(null), 5000);
  };

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.user) {
          setTotpEnabled(Boolean(j.user.totpEnabled));
        }
      })
      .catch(() => { /* swallow - card still renders, status reads as unknown */ })
      .finally(() => { if (alive) setMeLoading(false); });
    return () => { alive = false; };
  }, []);

  const submitPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    if (!currentPassword || !newPassword) {
      setPwError('Fill all three fields.');
      return;
    }
    if (newPassword.length < 8) {
      setPwError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwError('New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setPwError('New password must differ from the current one.');
      return;
    }
    setPwBusy(true);
    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirm: confirmPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code as string | undefined;
        if (code === 'WRONG_CURRENT_PASSWORD') {
          setPwError('Current password is incorrect.');
        } else if (code === 'RATE_LIMITED') {
          setPwError('Too many attempts. Wait a moment and try again.');
        } else {
          setPwError(data?.message ?? code ?? 'Password change failed.');
        }
        return;
      }
      flash('ok', 'Password changed. Other devices have been signed out. Please log in again on this device.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      // The change-password endpoint revokes every other session and
      // also revokes the current cookie's underlying session. Bounce
      // the admin to /admin/login so they re-authenticate with the
      // new credentials immediately. The flash toast is shown via
      // localStorage so it survives the navigation.
      try {
        window.localStorage.setItem('admin.account.toast', 'Password changed. Please log in again.');
      } catch { /* swallow */ }
      window.setTimeout(() => router.push('/admin/login'), 1200);
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setPwBusy(false);
    }
  };

  const startEnrollment = async () => {
    setTwofaError(null);
    setQrDataUrl(null);
    setVerifyCode('');
    setEnrolling(true);
    try {
      const res = await fetch('/api/auth/2fa/setup', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.qrDataUrl) {
        setTwofaError(data?.message ?? data?.code ?? '2FA setup failed.');
        return;
      }
      setQrDataUrl(String(data.qrDataUrl));
    } catch (e) {
      setTwofaError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setEnrolling(false);
    }
  };

  const verifyEnrollment = async () => {
    if (!verifyCode || verifyCode.trim().length < 4) {
      setTwofaError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setTwofaError(null);
    setVerifying(true);
    try {
      const res = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: verifyCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code as string | undefined;
        if (code === 'INVALID_CODE') {
          setTwofaError('That code did not match. Wait for a fresh one and try again.');
        } else if (code === 'RATE_LIMITED') {
          setTwofaError('Too many attempts. Wait a moment and try again.');
        } else {
          setTwofaError(data?.message ?? code ?? 'Verification failed.');
        }
        return;
      }
      setTotpEnabled(true);
      setQrDataUrl(null);
      setVerifyCode('');
      if (Array.isArray(data?.recoveryCodes)) {
        setRecoveryCodes(data.recoveryCodes as string[]);
      }
      flash('ok', '2FA enabled. Save the recovery codes below somewhere safe.');
    } catch (e) {
      setTwofaError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setVerifying(false);
    }
  };

  const submitDisable = async () => {
    if (!disableCode || disableCode.trim().length < 4) {
      setTwofaError('Enter a current code or a recovery code to confirm.');
      return;
    }
    setTwofaError(null);
    setDisableBusy(true);
    try {
      const res = await fetch('/api/auth/2fa/disable', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: disableCode.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const code = data?.code as string | undefined;
        if (code === 'INVALID_CODE') {
          setTwofaError('That code did not work. Try a fresh authenticator code or one of your recovery codes.');
        } else {
          setTwofaError(data?.message ?? code ?? 'Disable failed.');
        }
        return;
      }
      setTotpEnabled(false);
      setRecoveryCodes(null);
      setDisableOpen(false);
      setDisableCode('');
      flash('ok', '2FA disabled. Your account is now protected by password only.');
    } catch (e) {
      setTwofaError(e instanceof Error ? e.message : 'Network error.');
    } finally {
      setDisableBusy(false);
    }
  };

  const copyRecovery = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setRecoveryCopied(true);
      window.setTimeout(() => setRecoveryCopied(false), 3000);
    } catch {
      flash('err', 'Could not copy. Select the codes manually.');
    }
  };

  const downloadRecovery = () => {
    if (!recoveryCodes) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const blob = new Blob(
      [
        `Pasha 9 - Admin 2FA recovery codes\nGenerated: ${new Date().toUTCString()}\n\n`,
        recoveryCodes.join('\n'),
        '\n\nEach code works exactly once. Store securely. If you lose them AND your authenticator app, you lose access.\n',
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pasha9-admin-2fa-recovery-${stamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        icon={<ShieldCheck className="h-5 w-5" />}
        title="My Account"
        subtitle="Change your password and manage two-factor authentication for this admin account."
      />

      {toast ? (
        <Card padding="md" className={`mb-4 border-l-4 ${toast.kind === 'ok' ? 'border-emerald-400/70' : 'border-rose-400/70'}`}>
          <p className={`text-sm ${toast.kind === 'ok' ? 'text-emerald-200' : 'text-rose-200'}`}>{toast.text}</p>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Password change card */}
        <Card padding="lg">
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><KeyRound className="h-4 w-4" />Change password</span>}
            subtitle="Updating your password signs you out of every other device, so anyone who held a stolen session loses access immediately."
          />
          <form onSubmit={submitPasswordChange} className="mt-4 space-y-4" noValidate>
            <FormField label="Current password" required>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
              />
            </FormField>
            <FormField label="New password" required hint="At least 8 characters. Use a passphrase you can remember.">
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </FormField>
            <FormField label="Confirm new password" required>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
              />
            </FormField>
            {pwError ? (
              <p className="rounded-md border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {pwError}
              </p>
            ) : null}
            <Button type="submit" variant="gold" loading={pwBusy} leftIcon={<RefreshCw className="h-3.5 w-3.5" />}>
              Update password
            </Button>
          </form>
        </Card>

        {/* 2FA card */}
        <Card padding="lg">
          <CardHeader
            title={<span className="inline-flex items-center gap-2"><Smartphone className="h-4 w-4" />Two-factor authentication (TOTP)</span>}
            subtitle="A second login factor that protects your account if the password ever leaks. Works with Google Authenticator, Authy, 1Password, and other authenticator apps."
          />

          {meLoading ? (
            <p className="mt-4 text-sm text-ink-mid">Loading status...</p>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center gap-2">
                <Chip tone={totpEnabled ? 'ok' : 'warn'}>
                  {totpEnabled ? 'Enabled' : 'Disabled'}
                </Chip>
                {totpEnabled ? (
                  <span className="text-xs text-ink-lo">Sign-in requires a fresh code from your authenticator app.</span>
                ) : (
                  <span className="text-xs text-ink-lo">Strongly recommended for super admin accounts.</span>
                )}
              </div>

              {totpEnabled === false ? (
                <>
                  {qrDataUrl ? (
                    <div className="space-y-3 rounded-lg border border-amber-300/30 bg-amber-500/5 p-4">
                      <p className="text-sm font-semibold text-amber-200">Scan with your authenticator app</p>
                      <p className="text-xs text-amber-200/85">
                        Open Google Authenticator (or Authy / 1Password / etc.) and tap "Add". Point the camera at the QR. Then type the 6-digit code below to confirm.
                      </p>
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={qrDataUrl} alt="TOTP QR" className="h-44 w-44 rounded-md border border-white/10 bg-white p-2" />
                      </div>
                      <FormField label="6-digit code from the app" required>
                        <Input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          value={verifyCode}
                          onChange={(e) => setVerifyCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 8))}
                          placeholder="123456"
                        />
                      </FormField>
                      <div className="flex gap-2">
                        <Button onClick={verifyEnrollment} loading={verifying} variant="gold" leftIcon={<Check className="h-3.5 w-3.5" />}>
                          Verify and enable
                        </Button>
                        <Button onClick={() => { setQrDataUrl(null); setVerifyCode(''); }} variant="ghost">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button onClick={startEnrollment} loading={enrolling} variant="gold" leftIcon={<ScanLine className="h-3.5 w-3.5" />}>
                      Start 2FA enrollment
                    </Button>
                  )}
                </>
              ) : totpEnabled === true ? (
                <div className="space-y-3">
                  {recoveryCodes ? (
                    <div className="rounded-lg border border-amber-300/30 bg-amber-500/5 p-3">
                      <p className="text-sm font-bold text-amber-200">Save these recovery codes</p>
                      <p className="mt-1 text-xs text-amber-200/85">
                        Each code works exactly once. Store them in a password manager or a safe. If you lose your authenticator app AND these codes, you lose access to this admin account.
                      </p>
                      <ul className="mt-2 grid grid-cols-2 gap-1 font-mono text-sm tabular-nums text-amber-100">
                        {recoveryCodes.map((c, i) => (
                          <li key={i} className="rounded bg-black/30 px-2 py-1">{c}</li>
                        ))}
                      </ul>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="ghost" leftIcon={recoveryCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} onClick={copyRecovery}>
                          {recoveryCopied ? 'Copied' : 'Copy'}
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={<Download className="h-3 w-3" />} onClick={downloadRecovery}>
                          Download .txt
                        </Button>
                      </div>
                    </div>
                  ) : null}
                  <Button variant="danger" onClick={() => setDisableOpen(true)} leftIcon={<LogOut className="h-3.5 w-3.5" />}>
                    Disable 2FA
                  </Button>
                </div>
              ) : null}

              {twofaError ? (
                <p className="rounded-md border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {twofaError}
                </p>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <Modal open={disableOpen} onOpenChange={(v) => { if (!v) { setDisableOpen(false); setDisableCode(''); } }} title="Disable 2FA" size="sm">
        <div className="space-y-3">
          <p className="flex items-start gap-2 text-sm text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>This removes the second factor on your account. Anyone with your password will be able to log in. To confirm, enter a current 6-digit code from your authenticator OR one of your recovery codes.</span>
          </p>
          <FormField label="Code" required>
            <Input
              inputMode="numeric"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/[^0-9A-Za-z-]/g, '').slice(0, 20))}
              placeholder="123456"
            />
          </FormField>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setDisableOpen(false); setDisableCode(''); }}>Cancel</Button>
            <Button variant="danger" loading={disableBusy} onClick={submitDisable}>Disable 2FA</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
