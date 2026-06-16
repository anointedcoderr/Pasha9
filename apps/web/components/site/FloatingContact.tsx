// Built by Anointed Coder.
//
// Babu-style floating support button. Tapping the floating yellow chat
// bubble opens a vertical stack of WhatsApp / Telegram / Live Chat /
// Email options (whichever the admin has configured under System
// Settings > Public Support Contacts). Live Chat always links to the
// internal /support page so the menu is never empty; the others are
// hidden when their URL is not set.

'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { MessageCircle, Send, X, Mail, Headphones } from 'lucide-react';
import { useLang } from '@/lib/i18n/context';

interface ClientContacts {
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function FloatingContact() {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ClientContacts | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/content/contacts')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (alive && data) {
          setContacts({
            telegram: data.telegram ?? null,
            whatsapp: data.whatsapp ?? null,
            email: data.email ?? null,
          });
        }
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onClick = (e: MouseEvent) => {
      if (!panelRef.current) return;
      if (!panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onClick);
    };
  }, [open]);

  const labels = {
    whatsapp: 'WhatsApp',
    telegram: 'Telegram',
    chat: lang === 'bn' ? 'লাইভ চ্যাট' : 'Live Chat',
    email: lang === 'bn' ? 'ইমেইল' : 'Email',
    tagline: lang === 'bn' ? 'সাপোর্টে যোগাযোগ করুন' : 'Reach our support team',
  };

  return (
    // pointer-events-none on the outer wrapper so the closed dropdown
    // menu (which is opacity-0 but still occupies layout space and
    // therefore extends the wrapper's bounding box well above the chat
    // button) does NOT swallow taps on neighbouring fixed widgets
    // (HomeSpinShortcut at bottom-180px sits visually above the chat
    // button but inside this wrapper's box). The menu re-enables
    // pointer-events-auto when open; the chat button is always
    // tappable via its own className.
    <div
      ref={panelRef}
      className="pointer-events-none fixed bottom-[calc(120px+env(safe-area-inset-bottom))] right-3 z-50 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6"
    >
      <div
        role="menu"
        aria-label={labels.tagline}
        aria-hidden={!open}
        className={cn(
          'w-[228px] origin-bottom-right overflow-hidden rounded-2xl border border-brand-yellow-500/30 bg-brand-paper p-2 shadow-[0_22px_44px_-18px_rgba(15,17,21,0.4),0_0_0_1px_rgba(255,204,0,0.05)] transition-all duration-200',
          open ? 'pointer-events-auto translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0',
        )}
      >
        <div className="flex items-center justify-between border-b border-brand-divider px-2 pb-2 pt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-brand-inkMute">
            {labels.tagline}
          </p>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
        </div>
        <div className="mt-2 space-y-1">
          {contacts?.whatsapp ? (
            <a
              href={contacts.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(37,211,102,0.55)] ring-1 ring-black/5">
                <MessageCircle className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
              </span>
              <span className="text-sm font-semibold text-brand-ink">{labels.whatsapp}</span>
            </a>
          ) : null}
          {contacts?.telegram ? (
            <a
              href={contacts.telegram}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#229ED9] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(34,158,217,0.55)] ring-1 ring-black/5">
                <Send className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
              </span>
              <span className="text-sm font-semibold text-brand-ink">{labels.telegram}</span>
            </a>
          ) : null}
          <Link
            href="/support"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)] text-brand-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.55),inset_0_-2px_4px_rgba(168,114,0,0.35),0_4px_10px_-4px_rgba(245,180,0,0.7)] ring-1 ring-black/10">
              <Headphones className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
            </span>
            <span className="text-sm font-semibold text-brand-ink">{labels.chat}</span>
          </Link>
          {contacts?.email ? (
            <a
              href={`mailto:${contacts.email}`}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#1E73E8_0%,#1659C2_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_4px_10px_-4px_rgba(22,89,194,0.55)] ring-1 ring-black/5">
                <Mail className="h-4 w-4 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]" />
              </span>
              <span className="text-sm font-semibold text-brand-ink">{labels.email}</span>
            </a>
          ) : null}
        </div>
      </div>

      <button
        type="button"
        aria-label={open ? (lang === 'bn' ? 'বন্ধ' : 'Close support menu') : (lang === 'bn' ? 'সাপোর্ট খুলুন' : 'Open support menu')}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          // pointer-events-auto so the wrapper's pointer-events-none
          // does not suppress the chat button itself.
          'pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full text-brand-ink shadow-[0_10px_24px_-10px_rgba(245,180,0,0.85)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40',
          'bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)] hover:brightness-105',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
