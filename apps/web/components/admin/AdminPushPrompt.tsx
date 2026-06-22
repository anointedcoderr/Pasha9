// Built by Anointed Coder.
//
// One-time, dismissible banner shown in the admin shell when phone push
// is supported but not yet enabled on this device. Makes the feature
// discoverable the first time an admin opens the panel on their phone.
// Dismissal is remembered per-device via localStorage.

'use client';

import { useEffect, useState } from 'react';
import { BellRing, X, Loader2 } from 'lucide-react';
import { enableAdminPush, getAdminPushState } from '@/lib/push/fcm-client';

const DISMISS_KEY = 'pasha9_admin_push_prompt_dismissed';

export function AdminPushPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === 'undefined') return;
      if (localStorage.getItem(DISMISS_KEY) === '1') return;
      const s = await getAdminPushState();
      if (s.supported && !s.enabled) setShow(true);
    })();
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ }
    setShow(false);
  };

  const onEnable = async () => {
    setBusy(true); setMsg(null);
    const res = await enableAdminPush();
    setBusy(false);
    if (res.ok) { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* ignore */ } setShow(false); }
    else setMsg(res.message);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-brand-divider bg-brand-yellow-500/[0.08] px-4 py-2.5 md:px-6">
      <BellRing className="h-4 w-4 shrink-0 text-brand-yellow-700" />
      <p className="min-w-0 flex-1 text-xs font-semibold text-brand-ink">
        Turn on phone alerts to get notified of new deposits, withdrawals and VIP applications on this device.
        {msg ? <span className="ml-2 font-normal text-brand-inkSoft">{msg}</span> : null}
      </p>
      <button type="button" disabled={busy} onClick={onEnable}
        className="inline-flex items-center gap-2 rounded-lg bg-grad-yellow px-3 py-1.5 text-xs font-extrabold text-brand-ink disabled:opacity-50">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enable
      </button>
      <button type="button" aria-label="Dismiss" onClick={dismiss} className="text-brand-inkSoft hover:text-brand-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
