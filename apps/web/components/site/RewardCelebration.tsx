// Built by Anointed Coder.
//
// Generic reward-celebration popup. Listens to every notification kind
// in REWARD_KINDS and pops a congratulations dialog for each unread
// row in turn. Renders title/body verbatim from the Notification so the
// engine that emits the notification owns the copy.
//
// Sibling to CashbackCelebration (which keeps handling kind='cashback'
// with its own dedicated styling). Both are mounted in (site)/layout.tsx
// and listen to the same `pasha9:wallet-refresh` event so a wallet
// movement that produced a reward triggers a re-fetch immediately.

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Gift, Sparkles, X, Crown, Coins, Trophy, Users, Calendar, Tag } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

// Every kind this popup handles. CashbackCelebration owns 'cashback'.
const REWARD_KINDS = new Set([
  'deposit_bonus',
  'betting_pass_reward',
  'promo_code_granted',
  'referral_commission',
  'checkin_reward',
  'reward_coin_grant',
  'promotion_claim',
]);

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

type IconCmp = React.ComponentType<{ className?: string }>;
interface KindStyle { label: { en: string; bn: string }; icon: IconCmp; accent: string; }

const KIND_STYLES: Record<string, KindStyle> = {
  deposit_bonus:        { label: { en: 'Deposit Bonus', bn: 'ডিপোজিট বোনাস' },         icon: Gift,     accent: 'bg-amber-500/15 text-amber-300' },
  betting_pass_reward:  { label: { en: 'Betting Pass', bn: 'বেটিং পাস' },                icon: Crown,    accent: 'bg-violet-500/15 text-violet-200' },
  promo_code_granted:   { label: { en: 'Promo Code',   bn: 'প্রমো কোড' },                icon: Tag,      accent: 'bg-rose-500/15 text-rose-200' },
  referral_commission:  { label: { en: 'Referral',     bn: 'রেফারেল' },                  icon: Users,    accent: 'bg-emerald-500/15 text-emerald-300' },
  checkin_reward:       { label: { en: 'Daily Check-in', bn: 'দৈনিক চেক-ইন' },          icon: Calendar, accent: 'bg-sky-500/15 text-sky-200' },
  reward_coin_grant:    { label: { en: 'Reward Coins', bn: 'রিওয়ার্ড কয়েন' },         icon: Coins,    accent: 'bg-amber-500/15 text-amber-300' },
  promotion_claim:      { label: { en: 'Promotion',    bn: 'প্রমোশন' },                  icon: Trophy,   accent: 'bg-amber-500/15 text-amber-300' },
};

export function RewardCelebration() {
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
        (n) => n.kind != null && REWARD_KINDS.has(n.kind) && !n.readAt && !playedRef.current.has(n.recipientId),
      );
      if (rows.length === 0) return;
      setQueue((existing) => {
        const seen = new Set(existing.map((r) => r.recipientId));
        const additions = rows.filter((r) => !seen.has(r.recipientId));
        return [...existing, ...additions];
      });
    } catch {
      // Network hiccup; will retry on next mount / wallet-refresh.
    }
  }, []);

  useEffect(() => {
    refresh();
    const handler = () => refresh();
    window.addEventListener('pasha9:wallet-refresh', handler);
    return () => { window.removeEventListener('pasha9:wallet-refresh', handler); };
  }, [refresh]);

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
      // Server-side mark-read failure is non-fatal; popup will reappear
      // next page load until the read flips.
    }
  }, [active]);

  const style = useMemo(() => {
    if (!active?.kind) return null;
    return KIND_STYLES[active.kind] ?? null;
  }, [active]);

  if (!active) return null;

  const title = bn ? (active.titleBn ?? active.titleEn) : active.titleEn;
  const body = bn ? (active.bodyBn ?? active.bodyEn) : active.bodyEn;
  const Icon = style?.icon ?? Sparkles;
  const labelText = style ? (bn ? style.label.bn : style.label.en) : (bn ? 'পুরস্কার' : 'Reward');
  const labelAccent = style?.accent ?? 'bg-emerald-500/15 text-emerald-300';

  return (
    <Dialog.Root open={true} onOpenChange={(v) => { if (!v) void dismiss(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[1001] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-amber-400/40 bg-gradient-to-b from-[#2a1500] via-[#1e0e00] to-[#0d0700] p-0 text-amber-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.7)] data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95">
          <Dialog.Title className="sr-only">{title}</Dialog.Title>
          <Dialog.Description className="sr-only">{body ?? ''}</Dialog.Description>

          <div className="relative px-6 pb-6 pt-8 text-center">
            <button
              type="button"
              onClick={() => void dismiss()}
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-400/30 bg-black/30 text-amber-200 hover:bg-black/50"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] ${labelAccent}`}>
              <Icon className="h-3 w-3" />
              {labelText}
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
                {bn ? 'বিস্তারিত দেখুন' : 'View details'}
              </a>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
