// Built by Anointed Coder.
//
// Admin notification bell. Replaces the static dot placeholder that
// used to sit in AdminTopbar. Polls /api/admin/me/notifications every
// 30 seconds, shows an unread-count badge, and opens a popover with
// the 10 most recent admin-targeted notifications. Clicking an item
// marks it read and navigates to the linkUrl (e.g. /admin/deposits).

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck, Inbox } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';
import { cn } from '@/lib/utils/cn';

interface AdminNotification {
  recipientId: string;
  id: string;
  titleEn: string;
  titleBn: string | null;
  bodyEn: string | null;
  bodyBn: string | null;
  linkUrl: string | null;
  priority: string;
  kind: string | null;
  readAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

interface FeedResponse {
  unreadCount: number;
  notifications: AdminNotification[];
}

const POLL_MS = 30_000;
const VISIBLE_LIMIT = 10;

function relativeTime(iso: string, lang: 'en' | 'bn'): string {
  const then = new Date(iso).getTime();
  const diffSec = Math.max(1, Math.round((Date.now() - then) / 1000));
  if (diffSec < 60) return lang === 'bn' ? `${diffSec} সে আগে` : `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return lang === 'bn' ? `${diffMin} মি আগে` : `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return lang === 'bn' ? `${diffH} ঘ আগে` : `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  return lang === 'bn' ? `${diffD} দিন আগে` : `${diffD}d ago`;
}

export function AdminBell() {
  const router = useRouter();
  const { lang } = useLang();
  const [data, setData] = useState<FeedResponse | null>(null);
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/me/notifications', { cache: 'no-store', credentials: 'include' });
      if (!r.ok) return;
      const j = (await r.json()) as FeedResponse;
      setData(j);
    } catch {
      // network blip - keep prior state
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [load]);

  // Outside-click closes the popover; Escape too.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (popRef.current?.contains(t)) return;
      if (btnRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unreadCount ?? 0;
  const visible = useMemo(() => (data?.notifications ?? []).slice(0, VISIBLE_LIMIT), [data]);

  const markRead = async (recipientIds: string[]) => {
    if (recipientIds.length === 0) return;
    try {
      await fetch('/api/admin/me/notifications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientIds }),
      });
    } catch {
      // optimistic — refresh anyway
    }
    load();
  };

  const markAllRead = async () => {
    try {
      await fetch('/api/admin/me/notifications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
    } catch {
      // optimistic
    }
    load();
  };

  const onItemClick = async (n: AdminNotification) => {
    if (!n.readAt) {
      // Optimistically remove the unread badge so the count drops
      // immediately, then fire the server update + reload.
      setData((prev) => prev
        ? {
            unreadCount: Math.max(0, prev.unreadCount - 1),
            notifications: prev.notifications.map((row) =>
              row.recipientId === n.recipientId ? { ...row, readAt: new Date().toISOString() } : row,
            ),
          }
        : prev);
      markRead([n.recipientId]);
    }
    setOpen(false);
    if (n.linkUrl) router.push(n.linkUrl);
  };

  const heading = lang === 'bn' ? 'নোটিফিকেশন' : 'Notifications';
  const emptyText = lang === 'bn' ? 'কোনো নোটিফিকেশন নেই' : 'No notifications yet';
  const markAllLabel = lang === 'bn' ? 'সব পড়া হয়েছে' : 'Mark all read';
  const viewAllLabel = lang === 'bn' ? 'অপারেশনস দেখুন' : 'Open Operations';

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label={heading}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-brand-divider text-brand-inkSoft transition hover:text-brand-ink"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span
            aria-label={`${unread} unread`}
            className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold leading-none text-white shadow-[0_2px_6px_-1px_rgba(244,63,94,0.65)]"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popRef}
          role="dialog"
          aria-label={heading}
          className="absolute right-0 top-[44px] z-50 w-[min(92vw,360px)] overflow-hidden rounded-xl border border-brand-divider bg-brand-paper shadow-[0_24px_60px_-24px_rgba(15,17,21,0.45)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-brand-divider px-4 py-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-yellow-700" />
              <p className="text-sm font-extrabold text-brand-ink">{heading}</p>
              {unread > 0 ? (
                <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600">
                  {unread} {lang === 'bn' ? 'নতুন' : 'new'}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unread === 0}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-inkSoft transition hover:text-brand-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" /> {markAllLabel}
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {visible.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center text-brand-inkSoft">
                <Inbox className="h-6 w-6" />
                <p className="text-xs">{emptyText}</p>
              </div>
            ) : (
              <ul className="divide-y divide-brand-divider">
                {visible.map((n) => {
                  const title = (lang === 'bn' && n.titleBn) || n.titleEn;
                  const body = (lang === 'bn' && n.bodyBn) || n.bodyEn || '';
                  return (
                    <li key={n.recipientId}>
                      <button
                        type="button"
                        onClick={() => onItemClick(n)}
                        className={cn(
                          'flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-brand-surface',
                          !n.readAt && 'bg-brand-yellow-500/[0.06]',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            n.readAt ? 'bg-brand-divider' : 'bg-rose-500 shadow-[0_0_0_2px_rgba(244,63,94,0.2)]',
                          )}
                        />
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            'truncate text-[13px] leading-tight',
                            n.readAt ? 'font-semibold text-brand-ink' : 'font-extrabold text-brand-ink',
                          )}>
                            {title}
                          </p>
                          {body ? (
                            <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-brand-inkSoft">{body}</p>
                          ) : null}
                          <p className="mt-1 text-[10px] uppercase tracking-wider text-brand-inkMute">
                            {relativeTime(n.createdAt, lang === 'bn' ? 'bn' : 'en')}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="border-t border-brand-divider bg-brand-surface/40 px-4 py-2">
            <button
              type="button"
              onClick={() => { setOpen(false); router.push('/admin/operations'); }}
              className="inline-flex w-full items-center justify-center rounded-md px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand-inkSoft transition hover:bg-brand-paper hover:text-brand-ink"
            >
              {viewAllLabel}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
