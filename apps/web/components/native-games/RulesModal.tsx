// Built by Anointed Coder.
//
// Lightweight rules / how-to-play modal. Each game passes its own
// content as children. Built on the same Radix dialog primitive as
// the platform Modal so styling stays consistent.

'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLang } from '@/lib/i18n/context';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

export function RulesModal({ open, onOpenChange, title, children }: Props) {
  const { lang } = useLang();
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-1.5rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0F0A1E] p-5 text-white shadow-2xl outline-none">
          <div className="flex items-center justify-between gap-2">
            <Dialog.Title className="inline-flex items-center gap-2 text-base font-extrabold">
              <Info className="h-4 w-4 text-amber-300" />
              {lang === 'bn' ? `${title} - নিয়ম` : `${title} - rules`}
            </Dialog.Title>
            <Dialog.Close className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto pr-1 text-sm leading-relaxed text-white/85">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
