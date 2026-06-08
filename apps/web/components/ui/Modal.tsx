'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  hideClose?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const;

export function Modal({ open, onOpenChange, title, description, children, footer, size = 'md', hideClose }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-1rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-card',
            'max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)]',
            'surface-elev shadow-glow',
            'p-4 sm:p-6 md:p-8 outline-none',
            sizes[size],
          )}
        >
          {title || description ? (
            <div className="mb-4 shrink-0 pr-8">
              {title ? <Dialog.Title className="text-lg font-semibold text-ink-hi">{title}</Dialog.Title> : null}
              {description ? <Dialog.Description className="mt-1 text-sm text-ink-lo">{description}</Dialog.Description> : null}
            </div>
          ) : null}
          {!hideClose ? (
            <Dialog.Close className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-mid transition hover:bg-brand-surface hover:text-ink-hi focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 outline-none">
              <X className="h-4 w-4" />
            </Dialog.Close>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1">{children}</div>
          {footer ? <div className="mt-4 shrink-0 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Drawer({
  open,
  onOpenChange,
  side = 'right',
  title,
  description,
  children,
  footer,
  width = '420px',
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  side?: 'right' | 'left';
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Content
          style={{ width }}
          className={cn(
            'fixed top-0 z-50 flex h-[100dvh] max-w-[92vw] flex-col surface-elev p-4 sm:p-6 outline-none',
            side === 'right' ? 'right-0 border-l border-neon/10' : 'left-0 border-r border-neon/10',
          )}
        >
          {title || description ? (
            <div className="mb-4 shrink-0 pr-8">
              {title ? <Dialog.Title className="text-lg font-semibold text-ink-hi">{title}</Dialog.Title> : null}
              {description ? <Dialog.Description className="mt-1 text-sm text-ink-lo">{description}</Dialog.Description> : null}
            </div>
          ) : null}
          <Dialog.Close className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-mid hover:bg-brand-surface hover:text-ink-hi focus-visible:ring-2 focus-visible:ring-brand-blue-500/40 outline-none">
            <X className="h-4 w-4" />
          </Dialog.Close>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-4">{children}</div>
          {footer ? <div className="shrink-0 border-t border-brand-divider pt-3">{footer}</div> : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
