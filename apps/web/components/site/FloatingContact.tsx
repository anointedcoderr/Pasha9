// Built by Anointed Coder.
'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { MessageCircle, Send, X, Mail } from 'lucide-react';

interface ClientContacts {
  telegram: string | null;
  whatsapp: string | null;
  email: string | null;
}

export function FloatingContact() {
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ClientContacts | null>(null);

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

  const hasAny = !!(contacts?.telegram || contacts?.whatsapp || contacts?.email);
  if (!hasAny) return null;

  return (
    <div className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      <div
        className={cn(
          'flex flex-col items-end gap-3 transition-all duration-300',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        {contacts?.telegram ? (
          <a
            href={contacts.telegram}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-full border border-neon/20 bg-base-elev px-3 py-2 text-sm text-ink-hi shadow-glow"
          >
            <span className="hidden text-sm text-ink-mid sm:inline">Telegram</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#229ED9] text-white">
              <Send className="h-4 w-4" />
            </span>
          </a>
        ) : null}
        {contacts?.whatsapp ? (
          <a
            href={contacts.whatsapp}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-3 rounded-full border border-neon/20 bg-base-elev px-3 py-2 text-sm text-ink-hi shadow-glow"
          >
            <span className="hidden text-sm text-ink-mid sm:inline">WhatsApp</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
              <MessageCircle className="h-4 w-4" />
            </span>
          </a>
        ) : null}
        {contacts?.email ? (
          <a
            href={`mailto:${contacts.email}`}
            className="group flex items-center gap-3 rounded-full border border-neon/20 bg-base-elev px-3 py-2 text-sm text-ink-hi shadow-glow"
          >
            <span className="hidden text-sm text-ink-mid sm:inline">Email</span>
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gold-500 text-base-deep">
              <Mail className="h-4 w-4" />
            </span>
          </a>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Contact support"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full btn-gold shadow-glow-gold animate-pulseGlow"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
