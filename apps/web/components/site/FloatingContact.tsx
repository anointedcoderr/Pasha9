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
    <div
      ref={panelRef}
      className="fixed bottom-[96px] right-3 z-40 flex flex-col items-end gap-3 lg:bottom-6 lg:right-6"
    >
      <div
        className={cn(
          'w-[220px] origin-bottom-right rounded-2xl border border-brand-divider bg-brand-paper p-2 shadow-[0_18px_40px_-18px_rgba(15,17,21,0.35)] transition-all duration-200',
          open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-95 opacity-0',
        )}
      >
        <p className="px-2 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-brand-inkMute">
          {labels.tagline}
        </p>
        <div className="space-y-1">
          {contacts?.whatsapp ? (
            <a
              href={contacts.whatsapp}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#25D366] text-white">
                <MessageCircle className="h-4 w-4" />
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
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#229ED9] text-white">
                <Send className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-brand-ink">{labels.telegram}</span>
            </a>
          ) : null}
          <Link
            href="/support"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-yellow-500 text-brand-ink">
              <Headphones className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold text-brand-ink">{labels.chat}</span>
          </Link>
          {contacts?.email ? (
            <a
              href={`mailto:${contacts.email}`}
              className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition hover:bg-brand-surface"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-blue-500 text-white">
                <Mail className="h-4 w-4" />
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
          'inline-flex h-12 w-12 items-center justify-center rounded-full text-brand-ink shadow-[0_10px_24px_-10px_rgba(245,180,0,0.85)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue-500/40',
          'bg-[linear-gradient(135deg,#FFE066_0%,#FFCC00_55%,#F5B400_100%)] hover:brightness-105',
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
