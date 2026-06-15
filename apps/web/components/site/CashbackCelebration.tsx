// Built by Anointed Coder.
//
// Site-wide celebration popup that fires when the logged-in player has
// at least one unread Notification with kind='cashback'. Polls
// /api/me/notifications on mount, shows a congratulations modal for
// each unread cashback row in turn (newest first), and marks each one
// read via /api/me/notifications/read as the player taps Continue.
//
// The cashback engine at lib/cashback/engine.ts creates one
// Notification + NotificationRecipient pair per granted payout, with
// titleEn/titleBn already containing the BDT amount the player won
// ("Congratulations! You have received 50 BDT Cashback").
//
// Mounted in app/(site)/layout.tsx so the popup surfaces on the very
// next page navigation after the cashback is credited. The component
// renders nothing when no eligible notifications exist or the player
// is logged out.

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Trophy, X } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface MeNotification {
  recipientId: string;
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  linkUrl: string | null;
  imageUrl: string | null;
  priority: string;
  kind: string | null;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export function CashbackCelebration() {
  const { lang } = useLang();
  const bn = lang === 'bn';
  const [queue, setQueue] = useState<MeNotification[]>([]);
  const [active, setActive] = useState<MeNotification | null>(null);
  const playedRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/me/notifications', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) return;
      const data: { notifications?: MeNotification[] } = await res.json();
      const rows = (data.notifications ?? []).filter(
        (n) => n.kind === 'cashback' && !n.readAt && !playedRef.current.has(n.recipientId),
      );
      if (rows.length === 0) return;
      // Newest first (the API already sorts desc, keep that order).
      setQueue((existing) => {
        const seen = new Set(existing.map((r) => r.recipientId));
        const additions = rows.filter((r) => !seen.has(r.recipientId));
        return [...existing, ...additions];
      });
    } catch {
      // Network hiccup. Will retry on next mount / wallet-refresh tick.
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => { window.removeEventListener('pasha9:wallet-refresh', handler); };
  }, [refresh]);

  // Pop the head of the queue into `active`. We do this in an effect so
  // the next celebration only renders after the current one closes.
  useEffect(() => {
    if (active || queue.length === 0) return;
    const [head, ...rest] = queue;
    setActive(head);
    setQueue(rest);
    playedRef.current.add(head.recipientId);
    if (typeof window !== 'undefined' && typeof window.navigator?.vibrate === 'function') {
      window.navigator.vibrate?.([60, 50, 90]);
    }
  }, [active, queue]);

  const dismiss = useCallback(async () => {
    if (!active) return;
    const recipientId = active.recipientId;
    setActive(null);
    try {
      await fetch('/api/me/notifications/read', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ recipientId }),
      });
    } catch {
      // Marking-read failure means the same popup will reappear on
      // the next load. Not a data-integrity issue.
    }
  }, [active]);

  if (!active) return null;

  const title = bn ? (active.titleBn ?? active.titleEn) : active.titleEn;
  const body = bn ? (active.bodyBn ?? active.bodyEn) : active.bodyEn;

  return (
    <Dialog.Root open={true} onOpenChange={(v) => { if (!v) void dismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#2a1500] via-[#1e0e00] to-[#0d0700] p-0 text-amber-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{body ?? ''}</Dialog.Description>

          {/* Decorative ribbon backdrop. */}
          <div className="relative px-6 pb-6 pt-8 text-center">
            <button
              type="button"
              onClick={() => void dismiss()}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/30 bg-black/30 text-amber-200 hover:bg-black/50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-emerald-300">
              <Trophy className="h-3 w-3" />
              {bn ? 'ক্যাশব্যাক' : 'Cashback'}
            </span>

            <h2 className="mt-4 text-2xl font-black leading-tight text-amber-200">
              {title}
            </h2>

            {body ? (
              <p className="mt-3 text-sm leading-relaxed text-amber-100/80">
                {body}
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void dismiss()}
              className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-sm font-extrabold uppercase tracking-wider text-[#3a1f00] shadow-[0_8px_24px_-6px_rgba(245,180,0,0.5)] hover:brightness-105 active:brightness-95"
            >
              {bn ? 'ধন্যবাদ' : 'Awesome - Continue'}
            </button>

            {active.linkUrl ? (
              <a
                href={active.linkUrl}
                onClick={() => void dismiss()}
                className="mt-2 inline-block text-[11px] uppercase tracking-wider text-amber-300/70 hover:text-amber-200"
              >
                {bn ? 'ওয়ালেট দেখুন' : 'View in wallet'}
              </a>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
