'use client';

import { BRAND } from '@/lib/constants/brand';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { MessageCircle, Send, X } from 'lucide-react';

export function FloatingContact() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-5 right-4 z-30 flex flex-col items-end gap-3 md:bottom-6 md:right-6">
      <div
        className={cn(
          'flex flex-col items-end gap-3 transition-all duration-300',
          open ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <a
          href={BRAND.telegram}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-full border border-neon/20 bg-base-elev px-3 py-2 text-sm text-ink-hi shadow-glow"
        >
          <span className="hidden text-sm text-ink-mid sm:inline">Telegram</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#229ED9] text-white">
            <Send className="h-4 w-4" />
          </span>
        </a>
        <a
          href={BRAND.whatsapp}
          target="_blank"
          rel="noreferrer"
          className="group flex items-center gap-3 rounded-full border border-neon/20 bg-base-elev px-3 py-2 text-sm text-ink-hi shadow-glow"
        >
          <span className="hidden text-sm text-ink-mid sm:inline">WhatsApp</span>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white">
            <MessageCircle className="h-4 w-4" />
          </span>
        </a>
      </div>
      <button
        type="button"
        aria-label="Contact"
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full btn-gold shadow-glow-gold animate-pulseGlow"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  );
}
