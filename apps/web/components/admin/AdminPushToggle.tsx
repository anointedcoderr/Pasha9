// Built by Anointed Coder.
//
// Admin "Enable phone alerts" control. Lets a staff user register THIS
// device for FCM phone push and send a test. Shown on the admin
// notifications page. Reuses lib/push/fcm-client.ts.

'use client';

import { useEffect, useState } from 'react';
import { BellRing, BellOff, Send, Loader2 } from 'lucide-react';
import { enableAdminPush, disableAdminPush, getAdminPushState } from '@/lib/push/fcm-client';

export function AdminPushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const s = await getAdminPushState();
    setSupported(s.supported);
    setEnabled(s.enabled);
  };

  useEffect(() => { refresh(); }, []);

  const onEnable = async () => {
    setBusy(true); setMsg(null);
    const res = await enableAdminPush();
    setBusy(false);
    if (res.ok) { setMsg('Phone alerts enabled on this device.'); await refresh(); }
    else setMsg(res.message);
  };

  const onDisable = async () => {
    setBusy(true); setMsg(null);
    await disableAdminPush();
    setBusy(false);
    setMsg('Phone alerts disabled on this device.');
    await refresh();
  };

  const onTest = async () => {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch('/api/admin/push-devices/test', { method: 'POST', credentials: 'include' });
      const j = await res.json();
      setMsg(j?.push?.sent > 0 ? 'Test sent — check your phone.' : `No device received it (status: ${j?.push?.status ?? 'unknown'}).`);
    } catch {
      setMsg('Could not send the test.');
    }
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-brand-divider bg-brand-paper p-5">
      <div className="flex items-center gap-2">
        {enabled ? <BellRing className="h-5 w-5 text-emerald-600" /> : <BellOff className="h-5 w-5 text-brand-inkSoft" />}
        <h3 className="text-sm font-extrabold text-brand-ink">Phone push alerts</h3>
      </div>
      <p className="mt-1 text-xs text-brand-inkSoft">
        Get a push notification on this phone for new deposits, withdrawals, VIP applications and other admin actions —
        even when the screen is locked or the browser is closed. On iPhone, add this site to your Home Screen first.
      </p>

      {!supported ? (
        <p className="mt-3 text-xs font-semibold text-amber-600">
          This browser can&rsquo;t receive push here. On iPhone: Share &rarr; Add to Home Screen, open that, then enable.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {enabled ? (
            <button type="button" disabled={busy} onClick={onDisable}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-divider px-3 py-2 text-xs font-bold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />} Disable on this device
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={onEnable}
              className="inline-flex items-center gap-2 rounded-lg bg-grad-yellow px-3 py-2 text-xs font-extrabold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />} Enable phone alerts
            </button>
          )}
          {enabled && (
            <button type="button" disabled={busy} onClick={onTest}
              className="inline-flex items-center gap-2 rounded-lg border border-brand-divider px-3 py-2 text-xs font-bold text-brand-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send test
            </button>
          )}
        </div>
      )}

      {msg && <p className="mt-3 text-xs text-brand-inkSoft">{msg}</p>}
    </div>
  );
}
